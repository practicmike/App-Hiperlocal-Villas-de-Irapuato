import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  residentsTable,
  sessionsTable,
  accessKeysTable,
  type Resident,
} from "@workspace/db";
import { config } from "./config";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      resident?: Resident;
    }
  }
}

export const SESSION_COOKIE = "villas_session";

/** 32 bytes aleatorios: imposible de adivinar, a diferencia de un email o un id. */
export const newToken = () => crypto.randomBytes(32).toString("base64url");

/** En la base solo vive el hash; si alguien roba la base, no obtiene llaves válidas. */
export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

/** Solo dígitos; un número de 10 dígitos se asume mexicano (+52). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}

/** Revoca las llaves anteriores y entrega una nueva (el token en claro se muestra una vez). */
export async function issueAccessKey(residentId: string): Promise<string> {
  const token = newToken();
  await db.transaction(async (tx) => {
    await tx
      .update(accessKeysTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(accessKeysTable.residentId, residentId), isNull(accessKeysTable.revokedAt)));
    await tx.insert(accessKeysTable).values({ residentId, tokenHash: hashToken(token) });
  });
  return token;
}

export async function startSession(res: Response, residentId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000);
  await db.insert(sessionsTable).values({ tokenHash: hashToken(token), residentId, expiresAt });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Carga al vecino de la cookie en cada petición (si existe y no ha expirado). */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token.length > 20) {
    try {
      const [row] = await db
        .select({ resident: residentsTable })
        .from(sessionsTable)
        .innerJoin(residentsTable, eq(sessionsTable.residentId, residentsTable.id))
        .where(
          and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())),
        )
        .limit(1);
      if (row) req.resident = row.resident;
    } catch {
      // Base caída o sin tablas: se sigue sin sesión; la ruta explicará qué falta.
    }
  }
  next();
}

/** Solo vecinos aprobados entran al universo. */
export function requireResident(req: Request, res: Response, next: NextFunction) {
  if (!req.resident || req.resident.status !== "approved") {
    res.status(401).json({ message: "Necesitas tu acceso personal para entrar." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.resident || req.resident.status !== "approved" || req.resident.role !== "admin") {
    res.status(403).json({ message: "Solo el creador puede ver esto." });
    return;
  }
  next();
}
