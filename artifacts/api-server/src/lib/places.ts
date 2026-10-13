import { and, eq, sql } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { db, placesTable, endorsementsTable, residentsTable, visitsTable, constellationsTable, type Place } from "@workspace/db";
import { ensureSlug } from "./slug";
import { embed } from "./ai";
import { photosByPlace } from "./photos";
import { activeNews } from "./news";
import { placeEmbeddingText } from "./search-core";
import { logger } from "./logger";

/** Conteo de recomendaciones por lugar, en una sola consulta. */
export async function endorsementCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({ placeId: endorsementsTable.placeId, n: sql<number>`count(*)::int` })
    .from(endorsementsTable)
    .groupBy(endorsementsTable.placeId);
  return new Map(rows.map((r) => [r.placeId, r.n]));
}

/**
 * Tarjeta de una estrella. viewerId = null es un visitante sin llave: ve qué es
 * y cuántos vecinos lo recomiendan, pero no el contacto ni los nombres de vecinos.
 */
export async function placeDetail(place: Place, viewerId: string | null, opts: { shared?: boolean } = {}) {
  const [c] = await db
    .select({ isProperty: constellationsTable.isProperty })
    .from(constellationsTable)
    .where(eq(constellationsTable.id, place.constellation))
    .limit(1);
  const isProperty = c?.isProperty ?? false;
  const slug = await ensureSlug(place).catch(() => place.slug);
  const endorsements = await db
    .select({
      residentId: endorsementsTable.residentId,
      showName: endorsementsTable.showName,
      name: residentsTable.name,
    })
    .from(endorsementsTable)
    .innerJoin(residentsTable, eq(endorsementsTable.residentId, residentsTable.id))
    .where(eq(endorsementsTable.placeId, place.id))
    .orderBy(endorsementsTable.createdAt);
  const [v] = await db
    .select({
      neighbors: sql<number>`count(distinct ${visitsTable.residentId})::int`,
      mine: viewerId
        ? sql<number>`count(*) filter (where ${visitsTable.residentId} = ${viewerId})::int`
        : sql<number>`0`,
    })
    .from(visitsTable)
    .where(eq(visitsTable.placeId, place.id));

  const full = {
    id: place.id,
    constellation: place.constellation,
    name: place.name,
    category: place.category,
    description: place.description,
    contactName: place.contactName,
    whatsapp: place.whatsapp,
    zone: place.zone,
    operation: place.operation,
    priceLabel: place.priceLabel,
    imageUrl: place.imageUrl,
    verified: place.verified,
    sponsored: place.sponsored,
    endorsementCount: endorsements.length,
    // Solo el nombre de pila, y solo con permiso explícito del vecino.
    endorserNames: endorsements
      .filter((e) => e.showName)
      .map((e) => e.name.trim().split(/\s+/)[0]!)
      .slice(0, 5),
    endorsedByMe: viewerId !== null && endorsements.some((e) => e.residentId === viewerId),
    locked: false,
    welcomeOffer: place.welcomeOffer,
    slug,
    leadForm: false,
    neighborsServed: v?.neighbors ?? 0,
    myVisits: Number(v?.mine ?? 0),
    kind: place.kind,
    delivers: place.delivers,
    pickup: place.pickup,
    news: (await activeNews([place.id]))[0] ?? null,
    hours: place.hours ?? null,
    landM2: place.landM2,
    builtM2: place.builtM2,
    bedrooms: place.bedrooms,
    bathrooms: place.bathrooms,
    parking: place.parking,
    photos: (await photosByPlace([place.id])).get(place.id) ?? [],
  };
  if (viewerId !== null) return full;
  // Visitante con contacto abierto: casas (son anuncios para gente de fuera)
  // o el link público que el propio comercio compartió. Los nombres de vecinos siguen privados.
  if (isProperty || opts.shared) {
    return { ...full, endorserNames: [], leadForm: isProperty };
  }
  return {
    ...full,
    whatsapp: "",
    contactName: null,
    endorserNames: [],
    locked: true,
  };
}

export async function getActivePlace(id: string) {
  const [place] = await db
    .select()
    .from(placesTable)
    .where(and(eq(placesTable.id, id), eq(placesTable.active, true)))
    .limit(1);
  return place;
}

/**
 * Recalcula el embedding en segundo plano. Si falla o no hay llave de OpenAI,
 * el lugar sigue siendo encontrable por palabras.
 *
 * waitUntil: en Vercel la función se congela al responder; esto le pide que
 * espere a que termine el cálculo. En Replit (proceso fijo) no cambia nada.
 */
export function refreshEmbedding(place: Place) {
  const job = (async () => {
    const vector = await embed(placeEmbeddingText(place));
    if (!vector) return;
    await db.update(placesTable).set({ embedding: vector }).where(eq(placesTable.id, place.id));
  })().catch((err) => logger.warn({ err, placeId: place.id }, "refreshEmbedding failed"));
  waitUntil(job);
}
