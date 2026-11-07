/**
 * Filtro de búsquedas ofensivas o fuera de lugar.
 * 1. Lista local de groserías (instantáneo, sin red, funciona aunque no haya IA).
 * 2. Moderación de OpenAI (gratis): sexual, odio, violencia, autolesión, etc.
 * Si la moderación falla, se deja pasar: nunca se bloquea por un error de red.
 */
import { config, aiEnabled } from "./config";
import { normalize } from "./search-core";
import { logger } from "./logger";

export const BLOCKED_MESSAGE =
  "Esta búsqueda no se puede realizar. Cuéntame qué necesitas: un plomero, una casa en renta, dónde desayunar…";

/**
 * Raíces de groserías comunes en México (ya normalizadas: sin acentos, minúsculas).
 * Se comparan contra palabras completas o su inicio, para no bloquear palabras
 * inocentes que solo las contienen ("computadora", "disputa").
 * Se amplía con lo que aparezca en el panel.
 */
const ROOTS = [
  "verga", "vergas", "pito", "pitos", "puto", "puta", "putas", "putos", "putit", "puteri",
  "chingad", "chingar", "chingon", "chinga", "chingue", "pendej", "culero", "culera", "culo", "culos",
  "mamada", "mamadas", "mamon", "mamona", "cabron", "cabrona", "pinche", "pinches", "joto", "jotos",
  "marica", "maricon", "zorra", "zorras", "pucha", "panocha", "panochas", "coger", "cogerm", "cogid",
  "nalgas", "chichis", "tetas", "porno", "porn", "escort", "prostitu", "putero",
  "cocaina", "narco", "sicario",
];
// Fuera a propósito (falsos positivos en búsquedas reales): "matar" (plagas), "pistola" (de silicón),
// "cristal" (vidriero), "sexo" (del bebé), "perico" (mascota). Lo grave lo atrapa la moderación de OpenAI.

/** Palabras que empiezan como una raíz pero son inocentes. */
const SAFE = new Set(["cultura", "culto", "cultivo", "culinaria", "pitonisa"]);

export function hasProfanity(text: string): boolean {
  const words = normalize(text).split(" ");
  return words.some((w) => !SAFE.has(w) && ROOTS.some((r) => w === r || (r.length >= 5 && w.startsWith(r))));
}

/** true si OpenAI marca el texto como inapropiado. Falla abierta (false) ante cualquier error. */
async function moderationFlagged(text: string): Promise<boolean> {
  if (!aiEnabled()) return false;
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.openai.apiKey}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text.slice(0, 400) }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) throw new Error(`OpenAI moderation ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ flagged?: boolean }> };
    return data.results?.[0]?.flagged === true;
  } catch (err) {
    logger.warn({ err }, "moderation failed, allowing search");
    return false;
  }
}

export async function isBlockedSearch(text: string): Promise<boolean> {
  return hasProfanity(text) || (await moderationFlagged(text));
}
