import { Router, type IRouter } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, residentsTable, invitesTable, accessKeysTable } from "@workspace/db";
import {
  GetCreatorResponse,
  JoinWithInviteBody,
  RequestAccessBody,
  LoginWithKeyBody,
  UpdateMeBody,
} from "@workspace/api-zod";
import {
  hashToken,
  normalizePhone,
  startSession,
  endSession,
  requireResident,
} from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { config, aiEnabled } from "../lib/config";

const router: IRouter = Router();

const me = (r: { id: string; name: string; role: "resident" | "admin"; showNameOnEndorsements: boolean }) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  showNameOnEndorsements: r.showNameOnEndorsements,
});

router.get("/creator", (_req, res) => {
  res.json(
    GetCreatorResponse.parse({
      name: config.creator.name,
      message: config.creator.message,
      whatsapp: config.creator.whatsapp,
      photoUrl: config.creator.photoUrl,
      aiEnabled: aiEnabled(),
    }),
  );
});

/** Canje del código: el vecino queda pendiente hasta que el creador lo conozca y lo apruebe. */
router.post("/auth/join", rateLimit("join", 10, 60 * 60_000), async (req, res) => {
  const body = JoinWithInviteBody.parse(req.body);
  const code = body.code.trim().toUpperCase();
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) {
    res.status(400).json({ message: "Revisa tu número de WhatsApp (10 dígitos)." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [invite] = await tx
      .select({ invite: invitesTable, inviter: residentsTable })
      .from(invitesTable)
      .innerJoin(residentsTable, eq(invitesTable.createdById, residentsTable.id))
      .where(and(eq(invitesTable.code, code), isNull(invitesTable.usedById)))
      .for("update")
      .limit(1);
    if (!invite) return { error: "Ese código no existe o ya se usó." } as const;

    const [existing] = await tx
      .select({ id: residentsTable.id })
      .from(residentsTable)
      .where(eq(residentsTable.phone, phone))
      .limit(1);
    if (existing) return { error: "Ese WhatsApp ya está registrado. Escríbele al creador." } as const;

    const [resident] = await tx
      .insert(residentsTable)
      .values({
        name: body.name.trim(),
        phone,
        zone: body.zone?.trim() || null,
        invitedById: invite.inviter.id,
        inviteCode: code,
      })
      .returning();
    await tx
      .update(invitesTable)
      .set({ usedById: resident!.id, usedAt: new Date() })
      .where(eq(invitesTable.code, code));
    return { invitedBy: invite.inviter.name } as const;
  });

  if ("error" in result) {
    res.status(400).json({ message: result.error });
    return;
  }
  res.status(201).json({ status: "pending", invitedBy: result.invitedBy });
});

/**
 * Pedir entrar sin código: el vecino deja nombre y WhatsApp y queda pendiente.
 * El creador lo conoce en persona, lo aprueba en el panel y le muestra su QR.
 */
router.post("/auth/request", rateLimit("request", 5, 60 * 60_000), async (req, res) => {
  const body = RequestAccessBody.parse(req.body);
  const phone = normalizePhone(body.phone);
  if (phone.length < 12) {
    res.status(400).json({ message: "Revisa tu número de WhatsApp (10 dígitos)." });
    return;
  }
  const [existing] = await db
    .select({ status: residentsTable.status })
    .from(residentsTable)
    .where(eq(residentsTable.phone, phone))
    .limit(1);
  if (existing) {
    res.status(400).json({
      message:
        existing.status === "pending"
          ? "Ya recibimos tu solicitud. Pronto te contactan para darte de alta."
          : "Ese WhatsApp ya está registrado. Si perdiste tu acceso, pide uno nuevo en persona.",
    });
    return;
  }
  await db.insert(residentsTable).values({ name: body.name.trim(), phone, zone: body.zone?.trim() || null });
  res.status(201).end();
});

/**
 * Entrar con la llave personal que el creador envió por WhatsApp.
 * Es de un solo uso: si alguien reenvía el link, a esa otra persona no le abre.
 */
const KEY_GRACE_MS = 15 * 60_000;
const KEY_MAX_SESSIONS = 2;

router.post("/auth/key", rateLimit("key", 20, 15 * 60_000), async (req, res) => {
  const { token } = LoginWithKeyBody.parse(req.body);
  const [row] = await db
    .select({ key: accessKeysTable, resident: residentsTable })
    .from(accessKeysTable)
    .innerJoin(residentsTable, eq(accessKeysTable.residentId, residentsTable.id))
    .where(and(eq(accessKeysTable.tokenHash, hashToken(token)), isNull(accessKeysTable.revokedAt)))
    .limit(1);

  if (!row || row.resident.status !== "approved") {
    res.status(401).json({ message: "Este acceso ya no es válido. Pide uno nuevo al creador." });
    return;
  }

  // El mismo vecino que ya tiene sesión en este teléfono vuelve a tocar su link:
  // entra directo, sin gastar la llave ni contarlo como intento sospechoso.
  if (req.resident?.id === row.resident.id) {
    res.json(me(row.resident));
    return;
  }

  const now = new Date();
  const first = row.key.firstUsedAt;
  const withinGrace = first !== null && now.getTime() - first.getTime() <= KEY_GRACE_MS;
  const allowed = first === null || (withinGrace && row.key.sessionsCreated < KEY_MAX_SESSIONS);

  if (!allowed) {
    // Queda registrado: el creador lo ve en el panel como aviso.
    await db
      .update(accessKeysTable)
      .set({ rejectedAttempts: sql`${accessKeysTable.rejectedAttempts} + 1` })
      .where(eq(accessKeysTable.id, row.key.id));
    res.status(401).json({
      message: "Este acceso ya se usó en otro teléfono. Por seguridad solo funciona una vez. Pide uno nuevo al creador.",
      used: true,
    });
    return;
  }

  await db
    .update(accessKeysTable)
    .set({
      firstUsedAt: first ?? now,
      lastUsedAt: now,
      sessionsCreated: sql`${accessKeysTable.sessionsCreated} + 1`,
    })
    .where(eq(accessKeysTable.id, row.key.id));
  await startSession(res, row.resident.id);
  res.json(me(row.resident));
});

router.post("/auth/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

router.get("/me", requireResident, (req, res) => {
  res.json(me(req.resident!));
});

router.patch("/me", requireResident, async (req, res) => {
  const body = UpdateMeBody.parse(req.body);
  const [updated] = await db
    .update(residentsTable)
    .set({ showNameOnEndorsements: body.showNameOnEndorsements })
    .where(eq(residentsTable.id, req.resident!.id))
    .returning();
  res.json(me(updated!));
});

export default router;
