import { and, eq, sql } from "drizzle-orm";
import { db, placesTable, endorsementsTable, residentsTable, type Place } from "@workspace/db";
import { embed } from "./ai";
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

/** Tarjeta completa de una estrella, vista por un vecino concreto. */
export async function placeDetail(place: Place, viewerId: string) {
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

  return {
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
    endorsedByMe: endorsements.some((e) => e.residentId === viewerId),
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
 */
export function refreshEmbedding(place: Place) {
  void (async () => {
    const vector = await embed(placeEmbeddingText(place));
    if (!vector) return;
    await db.update(placesTable).set({ embedding: vector }).where(eq(placesTable.id, place.id));
  })().catch((err) => logger.warn({ err, placeId: place.id }, "refreshEmbedding failed"));
}
