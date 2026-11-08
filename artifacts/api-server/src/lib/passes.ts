/**
 * «Te lo paso»: la hoja de referencia de BNI, entre comercios de Villas, sin que nadie elija a mano.
 *
 * - Al registrar una visita en A, el sistema le pasa el vecino a otro comercio que
 *   él aún no conoce y que tiene regalo de bienvenida. Vence en 7 días.
 * - Reparto parejo: va primero al comercio que MENOS pases ha recibido este mes,
 *   así todos reciben vecinos, no solo los populares. Empate: de otra categoría
 *   (para que el vecino brinque de Antojos a Cuidar) y luego el más cercano a A.
 * - Nunca a un competidor (mismo giro), ni a casas, ni de un ejemplo a un lugar real.
 * - El comercio puede cambiarlo a la segunda opción con un toque.
 * - Cuando el otro comercio registra la visita del vecino, el pase se canjea:
 *   queda que A le mandó un cliente. El regalo lo paga ese comercio, como hoy;
 *   no hay puntos ni dinero entre comercios. A gana visibilidad (impulso en búsquedas).
 */
import { and, asc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, constellationsTable, passesTable, placesTable, visitsTable, type Place } from "@workspace/db";
import { DEMO_WHATSAPP_PREFIX } from "./demo-places";
import { rankCandidates } from "./passes-rank";

export const PASS_DAYS = 7;
/** Ventana para el marcador del panel y el impulso en búsquedas. */
export const REFERRAL_WINDOW_DAYS = 30;
/** Impulso máximo por referencias (de 10 posibles; cada punto = 0.01 de relevancia). */
export const MAX_REFERRAL_BOOST = 5;

const TZ = "America/Mexico_City";

const isLive = () => and(isNull(passesTable.redeemedAt), gt(passesTable.expiresAt, new Date()));
const isDemo = (p: Pick<Place, "whatsapp">) => p.whatsapp.startsWith(DEMO_WHATSAPP_PREFIX);
const sameGiro = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

export type PassOption = { placeId: string; name: string; offer: string | null };

type Candidate = Place & { issued: number; otherConstellation: boolean; distance: number | null };

/** Metros entre dos puntos (suficiente para ordenar por cercanía dentro de una colonia). */
function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * A quién se le puede pasar este vecino desde `from`, ya en el orden del reparto.
 * Solo comercios activos con regalo, que el vecino no ha visitado, sin pase vivo
 * hacia ellos, que no son competencia de `from` y que no son casas.
 */
export async function passCandidates(from: Place, residentId: string): Promise<PassOption[]> {
  const monthStart = sql`date_trunc('month', now() at time zone ${TZ}) at time zone ${TZ}`;
  const [places, visited, live, issued] = await Promise.all([
    db
      .select({ p: placesTable })
      .from(placesTable)
      .innerJoin(constellationsTable, eq(placesTable.constellation, constellationsTable.id))
      .where(
        and(
          eq(placesTable.active, true),
          eq(constellationsTable.isProperty, false),
          sql`coalesce(trim(${placesTable.welcomeOffer}), '') <> ''`,
        ),
      ),
    db.selectDistinct({ placeId: visitsTable.placeId }).from(visitsTable).where(eq(visitsTable.residentId, residentId)),
    db
      .select({ placeId: passesTable.toPlaceId })
      .from(passesTable)
      .where(and(eq(passesTable.residentId, residentId), isLive())),
    // Pases DADOS este mes por destino (canjeados o no): el reparto se empareja desde el primer día.
    db
      .select({ placeId: passesTable.toPlaceId, n: sql<number>`count(*)::int` })
      .from(passesTable)
      .where(sql`${passesTable.createdAt} >= ${monthStart}`)
      .groupBy(passesTable.toPlaceId),
  ]);
  const skip = new Set([from.id, ...visited.map((v) => v.placeId), ...live.map((l) => l.placeId)]);
  const issuedBy = new Map(issued.map((i) => [i.placeId, i.n]));
  const origin = from.lat != null && from.lng != null ? { lat: from.lat, lng: from.lng } : null;
  const candidates: Candidate[] = places
    .map(({ p }) => p)
    .filter((p) => !skip.has(p.id) && isDemo(p) === isDemo(from) && !sameGiro(p.category, from.category))
    .map((p) => ({
      ...p,
      issued: issuedBy.get(p.id) ?? 0,
      otherConstellation: p.constellation !== from.constellation,
      distance: origin && p.lat != null && p.lng != null ? meters(origin, { lat: p.lat, lng: p.lng }) : null,
    }));
  return rankCandidates(candidates).map((p) => ({ placeId: p.id, name: p.name, offer: p.welcomeOffer }));
}

/** Da el pase al primero del reparto. Devuelve el pase y una alternativa por si el comercio quiere cambiarlo. */
export async function givePass(from: Place, residentId: string, fromVisitId: string) {
  const options = await passCandidates(from, residentId);
  const target = options[0];
  if (!target) return { pass: null, options: [] as PassOption[] };
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
    options: options.slice(1, 2),
  };
}

/** El comercio cambia el pase que acaba de dar a otro comercio que también aplica (un toque). */
export async function changePass(from: Place, passId: string, toPlaceId: string) {
  const [pass] = await db
    .select()
    .from(passesTable)
    .where(and(eq(passesTable.id, passId), eq(passesTable.fromPlaceId, from.id), isLive()))
    .limit(1);
  if (!pass) return { error: 404 as const };
  const target = (await passCandidates(from, pass.residentId)).find((o) => o.placeId === toPlaceId);
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
