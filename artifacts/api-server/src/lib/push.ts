/**
 * Notificaciones push SOLO para el creador. Los vecinos no reciben push.
 *
 * - Solo lo que pide acción (interesado en casa, avisos, quejas, solicitudes...).
 *   Lo demás llega en un resumen diario a las 8 am.
 * - Horario silencioso configurable. «Interesado en casa» lo ignora: es dinero.
 * - Sin llaves VAPID en el servidor, todo esto queda apagado sin romper nada.
 */
import webpush from "web-push";
import { waitUntil } from "@vercel/functions";
import { and, eq, sql } from "drizzle-orm";
import { db, pushPrefsTable, pushSubscriptionsTable, residentsTable } from "@workspace/db";
import { logger } from "./logger";

export const PUSH_KINDS = [
  { id: "interesado", label: "Interesado en una casa", hint: "Es tu comisión: llega aunque sea horario silencioso", ignoresQuiet: true },
  { id: "aviso_auto", label: "Aviso publicado solo", hint: "3 vecinos reportaron lo mismo y ya está público sin confirmar", ignoresQuiet: false },
  { id: "reporte", label: "Primer reporte de un vecino", hint: "Agua, luz, calle cerrada… para que no esperen a 3", ignoresQuiet: false },
  { id: "queja", label: "Queja de un vecino", hint: "Privada, sobre un negocio", ignoresQuiet: false },
  { id: "solicitud", label: "Alguien pide entrar", hint: "Vecino nuevo esperando aprobación", ignoresQuiet: false },
  { id: "recomendacion", label: "Recomendación o propuesta", hint: "Un vecino no encontró algo y te dejó una idea", ignoresQuiet: false },
  { id: "resumen", label: "Resumen diario (8 am)", hint: "Búsquedas, visitas, pases y vecinos nuevos del día anterior", ignoresQuiet: false },
] as const;
export type PushKind = (typeof PUSH_KINDS)[number]["id"];

const env = process.env;
const publicKey = env["VAPID_PUBLIC_KEY"] ?? "";
const privateKey = env["VAPID_PRIVATE_KEY"] ?? "";
const prodHost = env["VERCEL_PROJECT_PRODUCTION_URL"];
const subject = env["VAPID_SUBJECT"] ?? (prodHost ? `https://${prodHost}` : "mailto:orbitu@example.com");

export const pushAvailable = () => publicKey.length > 0 && privateKey.length > 0;
export const vapidPublicKey = () => (pushAvailable() ? publicKey : null);

let configured = false;
function configure() {
  if (configured || !pushAvailable()) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/** Hora de Irapuato (México no cambia de horario desde 2022). */
export function hourInMexico(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Mexico_City" }).format(now));
}

/** ¿Estamos en horario silencioso? Soporta rangos que cruzan medianoche (22 → 7). */
export function isQuiet(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export interface PushMessage {
  title: string;
  body?: string;
  /** Pantalla que abre al tocarla, ej. "/panel?tab=avisos". */
  url: string;
  /** Mismo tag = Android reemplaza la anterior en vez de apilar. */
  tag?: string;
}

/** Sin preferencias guardadas: todo encendido y silencio de 10 pm a 7 am. */
export const DEFAULT_PREFS = { muted: [] as string[], quietStart: 22 as number | null, quietEnd: 7 as number | null, digest: true };

/** ¿Este tipo le llega ahora al creador según sus preferencias? */
export function shouldSend(
  kind: PushKind,
  prefs: { muted: string[]; quietStart: number | null; quietEnd: number | null; digest: boolean } | null,
  now: Date,
): boolean {
  prefs ??= DEFAULT_PREFS;
  if (kind === "resumen" && !prefs.digest) return false;
  if (prefs.muted.includes(kind)) return false;
  const info = PUSH_KINDS.find((k) => k.id === kind)!;
  if (!info.ignoresQuiet && isQuiet(hourInMexico(now), prefs.quietStart, prefs.quietEnd)) return false;
  return true;
}

async function deliver(kind: PushKind, msg: PushMessage, now = new Date()): Promise<number> {
  if (!pushAvailable()) return 0;
  configure();
  const subs = await db
    .select({ s: pushSubscriptionsTable, p: pushPrefsTable })
    .from(pushSubscriptionsTable)
    .innerJoin(residentsTable, eq(residentsTable.id, pushSubscriptionsTable.residentId))
    .leftJoin(pushPrefsTable, eq(pushPrefsTable.residentId, pushSubscriptionsTable.residentId))
    .where(and(eq(residentsTable.role, "admin"), eq(residentsTable.status, "approved")));
  let sent = 0;
  const payload = JSON.stringify({ ...msg, tag: msg.tag ?? kind });
  for (const { s, p } of subs) {
    if (!shouldSend(kind, p, now)) continue;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: kind === "interesado" ? 24 * 3600 : 6 * 3600,
        urgency: kind === "interesado" || kind === "aviso_auto" ? "high" : "normal",
      });
      sent++;
      await db.update(pushSubscriptionsTable).set({ lastSentAt: now }).where(eq(pushSubscriptionsTable.endpoint, s.endpoint));
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // El teléfono ya no acepta (se desinstaló o se revocó el permiso).
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, s.endpoint));
      } else {
        logger.warn({ err, kind }, "push failed");
      }
    }
  }
  return sent;
}

/**
 * Avisarle al creador. No bloquea la respuesta al vecino y nunca la rompe:
 * si el push falla, el evento igual queda en el panel.
 */
export function notifyCreator(kind: PushKind, msg: PushMessage) {
  if (!pushAvailable()) return;
  waitUntil(deliver(kind, msg).catch((err) => logger.warn({ err, kind }, "notifyCreator failed")));
}

/** Prueba desde el panel: ignora preferencias para confirmar que el teléfono recibe. */
export async function sendTest(residentId: string): Promise<number> {
  if (!pushAvailable()) return 0;
  configure();
  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.residentId, residentId));
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "OrbiTú · prueba", body: "Así te van a llegar los avisos de Villas.", url: "/panel", tag: "prueba" }),
        { TTL: 600 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, s.endpoint));
      } else logger.warn({ err }, "push test failed");
    }
  }
  return sent;
}

/** Resumen de las últimas 24 h. No manda nada si no pasó nada. */
export async function sendDigest(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const { rows } = await db.execute(sql`
    select
      (select count(*) from searches where resident_id is not null and created_at >= ${since}) as searches,
      (select count(*) from searches where resident_id is not null and result_count = 0 and created_at >= ${since}) as empty,
      (select count(*) from visits where created_at >= ${since}) as visits,
      (select count(*) from contact_events where kind = 'whatsapp' and created_at >= ${since}) as whatsapp,
      (select count(*) from passes where created_at >= ${since}) as passes,
      (select count(*) from residents where role = 'resident' and status = 'approved' and approved_at >= ${since}) as joined,
      (select count(*) from residents where status = 'pending') as pending
  `);
  const r = rows[0] as Record<string, unknown>;
  const n = (k: string) => Number(r[k] ?? 0);
  const parts = [
    n("visits") && `${n("visits")} visitas`,
    n("searches") && `${n("searches")} búsquedas${n("empty") ? ` (${n("empty")} sin resultado)` : ""}`,
    n("whatsapp") && `${n("whatsapp")} WhatsApp a negocios`,
    n("passes") && `${n("passes")} pases`,
    n("joined") && `${n("joined")} vecinos nuevos`,
    n("pending") && `${n("pending")} esperan aprobación`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return 0;
  return deliver("resumen", { title: "Ayer en OrbiTú Villas", body: parts.join(" · "), url: "/panel?tab=kpis", tag: "resumen" }, now);
}
