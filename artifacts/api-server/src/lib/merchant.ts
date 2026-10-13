/**
 * Modo comercio: el teléfono del negocio registra las visitas de los vecinos.
 *
 * - El creador genera un link por comercio (/comercio/<token>) y se lo manda por WhatsApp.
 * - A diferencia de la llave del vecino, este link sí se puede abrir en varios
 *   teléfonos del mismo negocio (la caja y el celular del dueño, por ejemplo).
 * - Al generar uno nuevo, el anterior y todas sus sesiones dejan de funcionar.
 * - Cookie aparte de la del vecino: un mismo teléfono puede ser vecino y comercio.
 */
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, placesTable, merchantSessionsTable, residentsTable, type Place } from "@workspace/db";
import { hashToken, newToken } from "./auth";
import { config } from "./config";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchantPlace?: Place;
    }
  }
}

export const MERCHANT_COOKIE = "villas_comercio";
const MERCHANT_DAYS = 365;

export async function issueMerchantKey(placeId: string): Promise<string> {
  const token = newToken();
  await db.transaction(async (tx) => {
    await tx.delete(merchantSessionsTable).where(eq(merchantSessionsTable.placeId, placeId));
    await tx.update(placesTable).set({ merchantKeyHash: hashToken(token) }).where(eq(placesTable.id, placeId));
  });
  return token;
}

export async function startMerchantSession(res: Response, placeId: string) {
  const token = newToken();
  await db.insert(merchantSessionsTable).values({ tokenHash: hashToken(token), placeId });
  res.cookie(MERCHANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    expires: new Date(Date.now() + MERCHANT_DAYS * 86_400_000),
  });
}

export async function endMerchantSession(req: Request, res: Response) {
  const token = req.cookies?.[MERCHANT_COOKIE];
  if (typeof token === "string") {
    await db.delete(merchantSessionsTable).where(eq(merchantSessionsTable.tokenHash, hashToken(token)));
  }
  res.clearCookie(MERCHANT_COOKIE, { path: "/" });
}

/** Solo para rutas /merchant: carga el comercio de la cookie. */
export async function requireMerchant(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[MERCHANT_COOKIE];
  if (typeof token === "string" && token.length > 20) {
    const [row] = await db
      .select({ place: placesTable })
      .from(merchantSessionsTable)
      .innerJoin(placesTable, eq(merchantSessionsTable.placeId, placesTable.id))
      .where(eq(merchantSessionsTable.tokenHash, hashToken(token)))
      .limit(1);
    if (row && row.place.merchantKeyHash) {
      req.merchantPlace = row.place;
      next();
      return;
    }
  }
  res.status(401).json({ message: "Este teléfono no tiene el modo comercio. Pide tu link al creador." });
}

/** Sin 0/O ni 1/I: el comercio puede dictarlo o teclearlo sin confusiones. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newMemberCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const normalizeMemberCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Crea el código de credencial la primera vez que el vecino la abre. */
export async function ensureMemberCode(residentId: string, current: string | null): Promise<string> {
  if (current) return current;
  for (let i = 0; i < 5; i++) {
    const code = newMemberCode();
    try {
      const [row] = await db
        .update(residentsTable)
        .set({ memberCode: code })
        .where(and(eq(residentsTable.id, residentId), isNull(residentsTable.memberCode)))
        .returning({ memberCode: residentsTable.memberCode });
      if (row?.memberCode) return row.memberCode;
      // Otra petición simultánea ya lo creó: se usa ese.
      const [existing] = await db
        .select({ memberCode: residentsTable.memberCode })
        .from(residentsTable)
        .where(eq(residentsTable.id, residentId));
      if (existing?.memberCode) return existing.memberCode;
    } catch {
      // Choque improbable con otro código: se intenta otro.
    }
  }
  throw new Error("No pude crear el código de credencial");
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
