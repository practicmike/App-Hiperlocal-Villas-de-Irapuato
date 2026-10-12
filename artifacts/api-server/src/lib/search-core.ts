/**
 * Núcleo de búsqueda sin dependencias de base de datos ni red,
 * para poder probarlo de forma aislada.
 */

export interface SearchablePlace {
  id: string;
  constellation: string;
  name: string;
  category: string;
  description: string;
  contactName: string | null;
  zone: string | null;
  operation: string | null;
  priceLabel: string | null;
  boost: number;
}

/** Por debajo de este score una estrella no cuenta como coincidencia. */
export const MATCH_MIN = 0.35;

const STOPWORDS = new Set(
  (
    "a al algo alguien busco buscando cerca con de del el en es esta este hay la las lo los " +
    "me mi mis muy necesito para por que quien quiero se su sus un una unos unas y ya favor " +
    "donde como cual bueno buena buen recomiendan recomienden alguno alguna"
  ).split(" "),
);

/**
 * Sinónimos frecuentes: lo que la gente escribe → cómo suele estar dado de alta.
 * Se amplía con lo que aparezca en "búsquedas sin resultado" del panel.
 */
const SYNONYMS: Record<string, string[]> = {
  plomero: ["plomeria", "fuga"],
  fuga: ["plomeria"],
  electricista: ["electricidad", "luz"],
  luz: ["electricidad"],
  jardinero: ["jardineria", "pasto"],
  pasto: ["jardineria"],
  carpintero: ["carpinteria", "muebles"],
  pintor: ["pintura"],
  limpieza: ["limpiar", "aseo"],
  aire: ["clima", "minisplit"],
  minisplit: ["clima"],
  taco: ["taqueria", "tacos"],
  tacos: ["taqueria"],
  pizza: ["pizzeria"],
  hamburguesa: ["hamburguesas"],
  comida: ["restaurante", "domicilio", "cocina"],
  cenar: ["restaurante", "cena"],
  desayunar: ["desayunos", "cafe"],
  escuela: ["colegio", "kinder", "primaria"],
  colegio: ["escuela"],
  casa: ["casas", "inmueble", "venta", "renta"],
  departamento: ["depa", "renta"],
  rentar: ["renta"],
  comprar: ["venta"],
  recamaras: ["recamara", "habitaciones"],
  cuartos: ["recamaras", "recamara"],
  veterinario: ["veterinaria", "mascotas"],
  perro: ["mascotas", "veterinaria"],
  pastel: ["pasteleria", "postres"],
};

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Raíz corta para que "plomero" y "plomería" o "recámara" y "recámaras" coincidan. */
const stem = (word: string) => (word.length > 5 ? word.slice(0, 5) : word);

function fieldHit(token: string, words: string[]): boolean {
  const s = stem(token);
  return words.some((w) => w === token || (s.length >= 4 && w.startsWith(s)));
}

function placeFields(place: SearchablePlace): Array<[string[], number]> {
  return [
    [tokenize(place.name), 1],
    [tokenize(place.category), 0.95],
    [tokenize(`${place.description} ${place.contactName ?? ""}`), 0.7],
    [tokenize(`${place.zone ?? ""} ${place.operation ?? ""} ${place.priceLabel ?? ""}`), 0.6],
  ];
}

const variantsOf = (token: string) => [token, ...(SYNONYMS[token] ?? [])];

/** Peso de cada palabra de la búsqueda; 1 para todas si no se da. */
export type TokenWeight = (token: string) => number;

/**
 * Ponderación tipo IDF: una palabra que aparece en muchas estrellas ("casa")
 * distingue poco; una que aparece en pocas ("alberca") distingue mucho.
 * Sin esto, "casa con alberca" coincidía con todas las casas.
 * Las palabras que no aparecen en ninguna estrella pesan poco para no
 * castigar búsquedas con palabras de relleno ("urgente", "porfa").
 */
export function buildIdf(places: SearchablePlace[]): TokenWeight {
  const n = places.length;
  const allWords = places.map((p) => placeFields(p).flatMap(([w]) => w));
  const cache = new Map<string, number>();
  return (token) => {
    const cached = cache.get(token);
    if (cached !== undefined) return cached;
    const variants = variantsOf(token);
    const df = allWords.filter((words) => variants.some((v) => fieldHit(v, words))).length;
    const weight = df === 0 ? 0.5 * Math.log(1 + n) : Math.log(1 + n / df);
    cache.set(token, weight);
    return weight;
  };
}

/**
 * Coincidencia por palabras, de 0 a 1.
 * Peso por campo: nombre y giro valen más que la descripción.
 * Peso por palabra: el que da buildIdf (las palabras raras cuentan más).
 */
export function keywordScore(
  query: string,
  place: SearchablePlace,
  weightOf: TokenWeight = () => 1,
): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const fields = placeFields(place);

  let total = 0;
  let totalWeight = 0;
  for (const token of tokens) {
    let best = 0;
    for (const [words, fieldWeight] of fields) {
      for (const v of variantsOf(token)) {
        const w = v === token ? fieldWeight : fieldWeight * 0.85;
        if (w > best && fieldHit(v, words)) best = w;
      }
    }
    const tw = weightOf(token);
    total += best * tw;
    totalWeight += tw;
  }
  return totalWeight > 0 ? total / totalWeight : 0;
}

/** Texto con el que se calcula el embedding de cada estrella. */
export function placeEmbeddingText(p: SearchablePlace): string {
  return [p.name, p.category, p.description, p.contactName, p.zone, p.operation, p.priceLabel]
    .filter(Boolean)
    .join(". ");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/**
 * text-embedding-3-small da similitudes en un rango estrecho (≈0.2–0.6 en español corto).
 * Se estira a 0–1 para que el brillo en pantalla tenga diferencias visibles.
 * Idea tomada de RealdiaMinimal; los límites se ajustan con datos reales.
 */
export function calibrateSimilarity(sim: number, low = 0.28, high = 0.58): number {
  const c = Math.min(high, Math.max(low, sim));
  return (c - low) / (high - low);
}

/**
 * Orden final. El impulso pagado suma como máximo 0.1, así que un
 * patrocinado nunca supera a un resultado más de 0.1 más relevante.
 * El score que se devuelve (y que controla el brillo) es relevancia pura.
 */
export function rankMatches<T extends { score: number; boost: number }>(items: T[]): T[] {
  const bonus = (b: number) => Math.min(Math.max(b, 0), 10) * 0.01;
  return [...items].sort((x, y) => y.score + bonus(y.boost) - (x.score + bonus(x.boost)));
}
