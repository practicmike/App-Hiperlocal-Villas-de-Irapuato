/**
 * Fotos de las estrellas, guardadas en Postgres.
 * El celular del creador ya las manda reducidas (máx. 1600 px, ~200 KB),
 * así que cientos de fotos caben sin problema y no hay otro servicio que pagar.
 * Se sirven con caché de un año: el id de una foto nunca cambia de contenido.
 */
import { asc, inArray } from "drizzle-orm";
import { db, placePhotosTable } from "@workspace/db";

export interface PhotoRef {
  id: string;
  url: string;
  width: number;
  height: number;
}

export const photoUrl = (id: string) => `/api/photos/${id}`;

/** Fotos de varios lugares en una consulta, sin cargar los bytes. */
export async function photosByPlace(placeIds: string[]): Promise<Map<string, PhotoRef[]>> {
  const out = new Map<string, PhotoRef[]>();
  if (placeIds.length === 0) return out;
  const rows = await db
    .select({
      id: placePhotosTable.id,
      placeId: placePhotosTable.placeId,
      width: placePhotosTable.width,
      height: placePhotosTable.height,
    })
    .from(placePhotosTable)
    .where(inArray(placePhotosTable.placeId, placeIds))
    .orderBy(asc(placePhotosTable.position), asc(placePhotosTable.createdAt));
  for (const r of rows) {
    const list = out.get(r.placeId) ?? [];
    list.push({ id: r.id, url: photoUrl(r.id), width: r.width, height: r.height });
    out.set(r.placeId, list);
  }
  return out;
}

/** Reconoce el formato por sus primeros bytes; no se confía en lo que diga el navegador. */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
