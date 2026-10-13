/**
 * "Hoy en Villas": la novedad del día de cada estrella.
 * Una vigente por lugar (publicar otra la reemplaza) y caduca sola a las 24 h:
 * así nunca se llena de anuncios viejos y siempre hay una razón para volver mañana.
 */
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db, newsTable, placesTable, NEWS_HOURS } from "@workspace/db";
import { sniffImage } from "./photos";

export interface NewsItem {
  id: string;
  placeId: string;
  placeName: string;
  constellation: string;
  text: string;
  photoUrl: string | null;
  createdAt: string;
  expiresAt: string;
}

const fields = {
  id: newsTable.id,
  placeId: newsTable.placeId,
  placeName: placesTable.name,
  constellation: placesTable.constellation,
  text: newsTable.text,
  hasPhoto: sql<boolean>`${newsTable.photoData} is not null`,
  createdAt: newsTable.createdAt,
  expiresAt: newsTable.expiresAt,
};

type Row = { id: string; placeId: string; placeName: string; constellation: string; text: string; hasPhoto: boolean; createdAt: Date; expiresAt: Date };
const toItem = (r: Row): NewsItem => ({
  id: r.id,
  placeId: r.placeId,
  placeName: r.placeName,
  constellation: r.constellation,
  text: r.text,
  // La marca de tiempo evita que el celular muestre una foto vieja si se cambia.
  photoUrl: r.hasPhoto ? `/api/news/${r.id}/photo?v=${r.createdAt.getTime()}` : null,
  createdAt: r.createdAt.toISOString(),
  expiresAt: r.expiresAt.toISOString(),
});

/** Novedades vigentes de estrellas visibles, las más nuevas primero. */
export async function activeNews(placeIds?: string[]): Promise<NewsItem[]> {
  if (placeIds && placeIds.length === 0) return [];
  const rows = await db
    .select(fields)
    .from(newsTable)
    .innerJoin(placesTable, eq(newsTable.placeId, placesTable.id))
    .where(
      and(
        gt(newsTable.expiresAt, new Date()),
        eq(placesTable.active, true),
        placeIds ? inArray(newsTable.placeId, placeIds) : undefined,
      ),
    )
    .orderBy(desc(newsTable.createdAt));
  // Limpieza ocasional de lo caducado, sin tarea programada.
  if (Math.random() < 0.05) {
    void db.delete(newsTable).where(lt(newsTable.expiresAt, new Date(Date.now() - 86_400_000))).catch(() => {});
  }
  return rows.map(toItem);
}

export async function newsById(id: string): Promise<(NewsItem & { placeIdRaw: string }) | null> {
  const [r] = await db
    .select(fields)
    .from(newsTable)
    .innerJoin(placesTable, eq(newsTable.placeId, placesTable.id))
    .where(eq(newsTable.id, id))
    .limit(1);
  return r ? { ...toItem(r), placeIdRaw: r.placeId } : null;
}

export async function publishNews(placeId: string, text: string): Promise<NewsItem> {
  const id = await db.transaction(async (tx) => {
    await tx.delete(newsTable).where(eq(newsTable.placeId, placeId));
    const [row] = await tx
      .insert(newsTable)
      .values({ placeId, text: text.trim(), expiresAt: new Date(Date.now() + NEWS_HOURS * 3_600_000) })
      .returning({ id: newsTable.id });
    return row!.id;
  });
  return (await newsById(id))!;
}

/** null = no es imagen válida. */
export async function setNewsPhoto(id: string, buf: unknown): Promise<NewsItem | null> {
  const mime = Buffer.isBuffer(buf) ? sniffImage(buf) : null;
  if (!mime) return null;
  await db.update(newsTable).set({ photoMime: mime, photoData: buf as Buffer }).where(eq(newsTable.id, id));
  return newsById(id);
}

export const removeNews = (where: { id?: string; placeId?: string }) =>
  db.delete(newsTable).where(where.id ? eq(newsTable.id, where.id) : eq(newsTable.placeId, where.placeId!));
