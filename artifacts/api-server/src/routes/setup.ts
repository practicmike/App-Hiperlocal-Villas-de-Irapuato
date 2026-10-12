import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, databaseConfigError, residentsTable, runMigrations } from "@workspace/db";
import { RunSetupBody } from "@workspace/api-zod";
import { issueAccessKey, normalizePhone } from "../lib/auth";
import { logger } from "../lib/logger";

/**
 * Configuración inicial desde el navegador, sin terminal.
 * Protegida con SETUP_TOKEN (variable de entorno que solo conoce el creador).
 */
const router: IRouter = Router();

const EXPECTED_TABLES = [
  "residents",
  "invites",
  "access_keys",
  "sessions",
  "places",
  "endorsements",
  "searches",
  "complaints",
  "rate_limits",
];

const setupToken = () => process.env["SETUP_TOKEN"] ?? "";

/** Comparación en tiempo constante: no filtra cuántos caracteres coinciden. */
function tokenMatches(given: string) {
  const expected = setupToken();
  if (expected.length < 16) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function inspect() {
  const status = {
    setupEnabled: setupToken().length >= 16,
    databaseConfigured: !databaseConfigError,
    databaseReachable: false,
    tablesReady: false,
    hasAdmin: false,
    problem: null as string | null,
  };

  if (databaseConfigError) {
    status.problem = databaseConfigError;
    return status;
  }

  try {
    const result = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    status.databaseReachable = true;
    const present = new Set((result.rows as Array<{ table_name: string }>).map((r) => r.table_name));
    status.tablesReady = EXPECTED_TABLES.every((t) => present.has(t));
  } catch (err) {
    logger.warn({ err }, "setup: database unreachable");
    status.problem =
      "La variable DATABASE_URL existe, pero no pude conectarme a la base. Revisa que la URL sea la de Neon (con -pooler) y que la base esté activa.";
    return status;
  }

  if (status.tablesReady) {
    const [admin] = await db
      .select({ id: residentsTable.id })
      .from(residentsTable)
      .where(and(eq(residentsTable.role, "admin"), eq(residentsTable.status, "approved")))
      .limit(1);
    status.hasAdmin = Boolean(admin);
  }

  if (!status.tablesReady || !status.hasAdmin) {
    status.problem = status.setupEnabled
      ? "Falta la configuración inicial. Abre /setup para crear las tablas y tu cuenta."
      : "Falta la configuración inicial. Agrega la variable SETUP_TOKEN en Vercel, vuelve a desplegar y abre /setup.";
  }
  return status;
}

router.get("/setup/status", async (_req, res) => {
  res.json(await inspect());
});

router.post("/setup", async (req, res) => {
  if (setupToken().length < 16) {
    res.status(503).json({
      message: "Falta la variable SETUP_TOKEN en Vercel (mínimo 16 caracteres). Agrégala y vuelve a desplegar.",
    });
    return;
  }
  const body = RunSetupBody.parse(req.body);
  if (!tokenMatches(body.token)) {
    // Pausa ante un intento fallido: frena a quien intente adivinar la clave.
    await new Promise((r) => setTimeout(r, 1500));
    res.status(401).json({ message: "La clave de configuración no coincide con SETUP_TOKEN." });
    return;
  }
  if (databaseConfigError) {
    res.status(503).json({ message: databaseConfigError });
    return;
  }

  const phone = normalizePhone(body.phone);
  if (phone.length < 12) {
    res.status(400).json({ message: "Revisa tu WhatsApp (10 dígitos)." });
    return;
  }

  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, "setup: migrations failed");
    res.status(503).json({ message: `No pude crear las tablas: ${(err as Error).message}` });
    return;
  }

  // Crea la cuenta del creador o la actualiza si ese WhatsApp ya existe.
  const name = body.name.trim();
  const [existing] = await db.select().from(residentsTable).where(eq(residentsTable.phone, phone));
  const [admin] = existing
    ? await db
        .update(residentsTable)
        .set({ name, role: "admin", status: "approved", approvedAt: existing.approvedAt ?? new Date() })
        .where(eq(residentsTable.id, existing.id))
        .returning()
    : await db
        .insert(residentsTable)
        .values({ name, phone, role: "admin", status: "approved", approvedAt: new Date() })
        .returning();

  const token = await issueAccessKey(admin!.id);
  logger.info({ residentId: admin!.id }, "setup: creator key issued");
  res.json({ token, phone: admin!.phone, name: admin!.name });
});

export default router;
