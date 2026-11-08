/**
 * «Te lo paso»: la hoja de referencia de BNI, entre comercios de Villas.
 *
 * - Cada lugar tiene hasta 2 socios (los elige el creador en el panel).
 * - Al registrar una visita en A, el vecino recibe un pase al primer socio de A
 *   que aún no conoce y que tiene regalo de bienvenida. Vence en 7 días.
 * - Cuando B registra la visita de ese vecino, el pase se canjea: queda que A le
 *   mandó un cliente a B. El regalo lo paga B, como hoy: es su costo por un cliente nuevo.
 * - No hay puntos ni dinero entre comercios. A gana visibilidad (impulso en búsquedas).
 */
import { and, asc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, passesTable, placesTable, visitsTable, type Place } from "@workspace/db";

export const PASS_DAYS = 7;
export const MAX_PARTNERS = 2;
/** Ventana para el marcador del panel y el impulso en búsquedas. */
export const REFERRAL_WINDOW_DAYS = 30;
/** Impulso máximo por referencias (de 10 posibles; cada punto = 0.01 de relevancia). */
export const MAX_REFERRAL_BOOST = 5;

const TZ = "America/Mexico_City";

const isLive = () => and(isNull(passesTable.redeemedAt), gt(passesTable.expiresAt, new Date()));

export type PartnerOption = { placeId: string; name: string; offer: string | null };

/**
 * Socios de `place` a los que se le puede pasar este vecino ahora:
 * activos, con regalo, que el vecino no ha visitado y sin pase vivo hacia ellos.
 * En el orden en que el creador los puso.
 */
export async function eligiblePartners(place: Place, residentId: string): Promise<PartnerOption[]> {
  const ids = (place.partnerIds ?? []).filter((id) => id !== place.id);
  if (ids.length === 0) return [];
  const [partners, visited, live] = await Promise.all([
    db.select().from(placesTable).where(and(inArray(placesTable.id, ids), eq(placesTable.active, true))),
    db
      .selectDistinct({ placeId: visitsTable.placeId })
      .from(visitsTable)
      .where(and(eq(visitsTable.residentId, residentId), inArray(visitsTable.placeId, ids))),
    db
      .select({ placeId: passesTable.toPlaceId })
      .from(passesTable)
      .where(and(eq(passesTable.residentId, residentId), inArray(passesTable.toPlaceId, ids), isLive())),
  ]);
  const skip = new Set([...visited.map((v) => v.placeId), ...live.map((p) => p.placeId)]);
  const byId = new Map(partners.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Place => !!p && !!p.welcomeOffer?.trim() && !skip.has(p.id))
    .map((p) => ({ placeId: p.id, name: p.name, offer: p.welcomeOffer }));
}

/** Da el pase al primer socio que aplique. Devuelve el pase y los otros socios a los que se puede cambiar. */
export async function givePass(from: Place, residentId: string, fromVisitId: string) {
  const options = await eligiblePartners(from, residentId);
  const target = options[0];
  if (!target) return { pass: null, options: [] as PartnerOption[] };
  const [row] = await db
    .insert(passesTable)
    .values({
      residentId,
      fromPlaceId: from.id,
      toPlaceId: target.placeId,
      offer: target.offer!,
      fromVisitId,
      expiresAt: new Date(Date.now() + PASS_DAYS * 86_400_000),
    })
    .returning();
  return {
    pass: { id: row!.id, toPlaceId: target.placeId, toPlaceName: target.name, offer: row!.offer },
    options: options.slice(1),
  };
}

/** El comercio cambia a qué socio va el pase que acaba de dar (un toque). */
export async function changePass(from: Place, passId: string, toPlaceId: string) {
  const [pass] = await db
    .select()
    .from(passesTable)
    .where(and(eq(passesTable.id, passId), eq(passesTable.fromPlaceId, from.id), isLive()))
    .limit(1);
  if (!pass) return { error: 404 as const };
  const target = (await eligiblePartners(from, pass.residentId)).find((o) => o.placeId === toPlaceId);
  if (!target) return { error: 400 as const };
  await db
    .update(passesTable)
    .set({ toPlaceId: target.placeId, offer: target.offer! })
    .where(eq(passesTable.id, pass.id));
  return { pass: { id: pass.id, toPlaceId: target.placeId, toPlaceName: target.name, offer: target.offer! } };
}

/** Pase vivo del vecino hacia este lugar (el primero que vence), con el nombre de quien lo mandó. */
export async function livePassTo(residentId: string, placeId: string) {
  const [row] = await db
    .select({ id: passesTable.id, fromPlaceName: placesTable.name, expiresAt: passesTable.expiresAt })
    .from(passesTable)
    .innerJoin(placesTable, eq(passesTable.fromPlaceId, placesTable.id))
    .where(and(eq(passesTable.residentId, residentId), eq(passesTable.toPlaceId, placeId), isLive()))
    .orderBy(asc(passesTable.expiresAt))
    .limit(1);
  return row ?? null;
}

/** Canjea el pase vivo hacia este lugar con la visita recién registrada. Devuelve quién lo mandó. */
export async function redeemPass(residentId: string, placeId: string, visitId: string): Promise<string | null> {
  const live = await livePassTo(residentId, placeId);
  if (!live) return null;
  await db
    .update(passesTable)
    .set({ redeemedVisitId: visitId, redeemedAt: new Date() })
    .where(and(eq(passesTable.id, live.id), isNull(passesTable.redeemedAt)));
  return live.fromPlaceName;
}

/** Pases vivos del vecino, del que vence primero al último. */
export async function residentPasses(residentId: string) {
  const rows = await db
    .select({
      id: passesTable.id,
      toPlaceId: passesTable.toPlaceId,
      toPlaceName: placesTable.name,
      fromPlaceId: passesTable.fromPlaceId,
      offer: passesTable.offer,
      expiresAt: passesTable.expiresAt,
    })
    .from(passesTable)
    .innerJoin(placesTable, eq(passesTable.toPlaceId, placesTable.id))
    .where(and(eq(passesTable.residentId, residentId), isLive(), eq(placesTable.active, true)))
    .orderBy(asc(passesTable.expiresAt));
  if (rows.length === 0) return [];
  const from = await db
    .select({ id: placesTable.id, name: placesTable.name })
    .from(placesTable)
    .where(inArray(placesTable.id, [...new Set(rows.map((r) => r.fromPlaceId))]));
  const fromName = new Map(from.map((f) => [f.id, f.name]));
  return rows.map((r) => ({
    id: r.id,
    toPlaceId: r.toPlaceId,
    toPlaceName: r.toPlaceName,
    fromPlaceName: fromName.get(r.fromPlaceId) ?? "Un vecino de negocio",
    offer: r.offer,
    expiresAt: r.expiresAt.toISOString(),
  }));
}

/** Marcador del mes (hora de México) para la pantalla del comercio: pases que llegaron. */
export async function monthScore(placeId: string) {
  const thisMonth = sql`date_trunc('month', ${passesTable.redeemedAt} at time zone ${TZ}) = date_trunc('month', now() at time zone ${TZ})`;
  const [row] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${passesTable.fromPlaceId} = ${placeId} and ${thisMonth})::int`,
      received: sql<number>`count(*) filter (where ${passesTable.toPlaceId} = ${placeId} and ${thisMonth})::int`,
    })
    .from(passesTable)
    .where(sql`${passesTable.redeemedAt} is not null`);
  return { sent: row?.sent ?? 0, received: row?.received ?? 0 };
}

/** Pases canjeados en los últimos 30 días, por lugar que los mandó y por lugar que los recibió. */
export async function referralCounts() {
  const since = new Date(Date.now() - REFERRAL_WINDOW_DAYS * 86_400_000);
  const [sent, received] = await Promise.all([
    db
      .select({ placeId: passesTable.fromPlaceId, n: sql<number>`count(*)::int` })
      .from(passesTable)
      .where(gte(passesTable.redeemedAt, since))
      .groupBy(passesTable.fromPlaceId),
    db
      .select({ placeId: passesTable.toPlaceId, n: sql<number>`count(*)::int` })
      .from(passesTable)
      .where(gte(passesTable.redeemedAt, since))
      .groupBy(passesTable.toPlaceId),
  ]);
  return {
    sent: new Map(sent.map((r) => [r.placeId, r.n])),
    received: new Map(received.map((r) => [r.placeId, r.n])),
  };
}

/**
 * Impulso en búsquedas: el que manda vecinos sube un poco.
 * 1 punto por vecino que llegó (30 días), máximo 5, sumado al impulso pagado
 * y con el mismo tope total: nunca tapa un resultado claramente más relevante.
 */
export function referralBoost(sentLast30: number): number {
  return Math.min(MAX_REFERRAL_BOOST, Math.max(0, sentLast30));
}

/** Socios válidos para guardar: existen, no es el mismo lugar, sin repetidos, máximo 2. */
export async function cleanPartnerIds(placeId: string | null, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)].filter((id) => id !== placeId).slice(0, MAX_PARTNERS);
  if (unique.length === 0) return [];
  const found = await db.select({ id: placesTable.id }).from(placesTable).where(inArray(placesTable.id, unique));
  const ok = new Set(found.map((f) => f.id));
  return unique.filter((id) => ok.has(id));
}
