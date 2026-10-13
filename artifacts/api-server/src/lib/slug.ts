import { eq } from "drizzle-orm";
import { db, placesTable } from "@workspace/db";

/** "Pizzas del Parque" → "pizzas-del-parque" (sin acentos, fácil de dictar y teclear). */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "estrella"
  );
}

/** Le da a la estrella su link público la primera vez que se necesita; nunca cambia después. */
export async function ensureSlug(place: { id: string; name: string; slug: string | null }): Promise<string> {
  if (place.slug) return place.slug;
  const base = slugify(place.name);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    try {
      const [row] = await db
        .update(placesTable)
        .set({ slug: candidate })
        .where(eq(placesTable.id, place.id))
        .returning({ slug: placesTable.slug });
      if (row?.slug) return row.slug;
    } catch {
      // Ya lo usa otra estrella: se prueba con -2, -3…
    }
  }
  throw new Error("No pude crear el link de la estrella");
}
