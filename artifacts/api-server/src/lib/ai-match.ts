/**
 * Match semántico con IA (idea de RealdiaMinimal, hecha más barata):
 * 1. La búsqueda rápida (palabras + embeddings) elige hasta 12 candidatos.
 * 2. UNA llamada al modelo califica cada candidato de 0 a 100 contra lo que
 *    el vecino escribió y da una razón corta.
 * 3. El % decide cercanía y brillo en el universo; la razón va en la tarjeta.
 *
 * Entre más detalle tengan la búsqueda y la descripción del lugar, más
 * preciso es el % (el modelo compara significado, no palabras).
 */
import { config, aiEnabled } from "./config";
import { placeFacts, type SearchablePlace } from "./search-core";
import { isOpenNow, nowInVillas } from "./hours";
import { logger } from "./logger";

export type MatchCandidate = Pick<
  SearchablePlace,
  "id" | "name" | "category" | "description" | "zone" | "operation" | "priceLabel" | "kind" | "delivers" | "outsideVillas" | "hours" | "landM2" | "builtM2" | "bedrooms" | "bathrooms" | "parking"
>;

export interface AiMatch {
  placeId: string;
  /** 0–1 */
  score: number;
  reason: string;
}

/**
 * Desde este % se muestra. El modelo usa la franja 0–49 para "no sirve";
 * con el corte en 60 queda un colchón para que lo dudoso no se cuele.
 */
export const AI_MATCH_MIN = 60;
export const AI_MAX_CANDIDATES = 12;

/** El vecino pide algo para ya: solo entonces importa si está abierto. */
export const wantsNow = (query: string) =>
  /\b(ya|hoy|ahorita|ahora|abiert[oa]s?|urgente|urge|en este momento|esta noche|al rato)\b/i.test(query);

export function buildMatchPrompt(query: string, candidates: MatchCandidate[], now = new Date()) {
  const urgent = wantsNow(query);
  const list = candidates
    .map((c, i) =>
      [
        `[${i}] ${c.name} — ${c.category}`,
        c.operation ? `operación: ${c.operation}` : "",
        c.priceLabel ? `precio: ${c.priceLabel}` : "",
        c.zone ? `zona: ${c.zone}` : "",
        placeFacts(c as SearchablePlace) ? `datos: ${placeFacts(c as SearchablePlace)}` : "",
        (() => {
          // Sin urgencia el horario no se manda: el modelo tendía a castigar lo cerrado igual.
          if (!urgent) return "";
          const open = isOpenNow(c.hours, now);
          return open === null ? "" : open ? "ahora: ABIERTO" : "ahora: CERRADO";
        })(),
        c.description ? `descripción: ${c.description.slice(0, 700)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");

  return [
    {
      role: "system" as const,
      content:
        "Eres la anfitriona (hostess) de una guía vecinal de Villas de Irapuato (México): casas en venta o renta, oficios de confianza y comercios. " +
        "Primero interpreta qué necesita el vecino. Si su búsqueda admite varias lecturas (\"un lugar cómodo para estar\" puede ser vivir o pasar el rato), " +
        "elige la MÁS PROBABLE según sus palabras y califica con esa lectura. " +
        "Si la búsqueda NO pide un lugar, casa, servicio o comercio (preguntas generales, chistes, insultos, temas sin relación), " +
        "califica todo con 0 y en intro explica con amabilidad que solo ayudas a encontrar lugares, casas y servicios de Villas, con un ejemplo. " +
        "Para cada candidato, califica de 0 a 100 qué tan bien resuelve esa necesidad, por significado y no solo por palabras. " +
        "Rúbrica: 90-100 resuelve todo lo pedido; 75-89 resuelve lo principal con algún detalle sin confirmar; 60-74 sirve parcialmente; " +
        "0-40 no sirve. Usa 0-40 sin dudar para lo que no tiene relación; no uses 41-59. " +
        "Solo castiga una contradicción si el vecino la pidió EXPLÍCITAMENTE con sus palabras; nunca supongas requisitos que no escribió. " +
        "No inventes datos que no estén en la descripción. " +
        `Ahora es ${nowInVillas(now).label} en Irapuato. Si el vecino pide algo para ya, hoy, ahorita o abierto, un candidato CERRADO baja a 40 o menos; si no indica urgencia, el horario no castiga. ` +
        'La razón (reason): máximo 12 palabras, en español, dirigida al vecino, diciendo por qué SÍ le sirve y, si aplica, qué no se sabe ("Hace pizza a domicilio; no indica horario"). ' +
        'Para lo que no sirve (0-40) deja reason vacío. ' +
        'Además escribe "intro": 1 o 2 frases cálidas y naturales, de tú, como anfitriona que recibe al vecino. ' +
        'Di qué entendiste que busca y recomienda por nombre solo las 1 a 3 mejores opciones con 60 o más, con un dato concreto de cada una. ' +
        'Si elegiste una lectura entre varias, dilo con naturalidad ("Entendí que buscas dónde vivir"). ' +
        'Si nada llega a 60, dilo con amabilidad y sugiere cómo describirlo mejor. Máximo 45 palabras, sin emojis, sin porcentajes. ' +
        'Responde solo JSON: {"intro":"...","matches":[{"i":0,"score":85,"reason":"..."}]} incluyendo todos los candidatos.',
    },
    { role: "user" as const, content: `Lo que busca el vecino: "${query.slice(0, 400)}"\n\nCandidatos:\n${list}` },
  ];
}

/** Convierte la respuesta del modelo en matches válidos; ignora basura e índices inventados. */
export function parseMatchResponse(content: string, candidates: MatchCandidate[]): AiMatch[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const raw = (parsed as { matches?: unknown })?.matches;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<number>();
  const out: AiMatch[] = [];
  for (const m of raw) {
    const i = Number((m as { i?: unknown }).i);
    const score = Number((m as { score?: unknown }).score);
    const reason = String((m as { reason?: unknown }).reason ?? "").trim();
    if (!Number.isInteger(i) || i < 0 || i >= candidates.length || seen.has(i)) continue;
    if (!Number.isFinite(score) || score < AI_MATCH_MIN) continue;
    seen.add(i);
    out.push({
      placeId: candidates[i]!.id,
      score: Math.min(100, score) / 100,
      reason: reason.slice(0, 120),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Coincidencia obvia: la palabra buscada está en el nombre o el giro
 * ("colegio" → Colegio Montessori). Con este puntaje de palabras, nunca se descarta.
 */
export const KEYWORD_SURE = 0.5;

/**
 * Une el veredicto de la IA con la búsqueda por palabras. La IA ordena y explica,
 * pero no puede esconder una coincidencia obvia: si la calificó bajo o la omitió,
 * se conserva con su puntaje de palabras (sin razón), después de las que la IA aprobó.
 */
export function keepKeywordHits(
  ai: AiMatch[],
  candidates: Array<{ placeId: string; keyword: number }>,
): Array<{ placeId: string; score: number; reason: string | null }> {
  const inAi = new Set(ai.map((m) => m.placeId));
  const rescued = candidates
    .filter((c) => c.keyword >= KEYWORD_SURE && !inAi.has(c.placeId))
    .sort((a, b) => b.keyword - a.keyword)
    .map((c) => ({ placeId: c.placeId, score: Math.min(c.keyword, ai.at(-1)?.score ?? 1), reason: null }));
  return [...ai, ...rescued];
}

/** Mensaje de la anfitriona; null si viene vacío o roto. */
export function parseIntro(content: string): string | null {
  try {
    const intro = (JSON.parse(content) as { intro?: unknown })?.intro;
    const text = typeof intro === "string" ? intro.trim() : "";
    return text ? text.slice(0, 400) : null;
  } catch {
    return null;
  }
}

export interface AiResult {
  matches: AiMatch[];
  /** Mensaje de la anfitriona para arriba de la lista. */
  intro: string | null;
}

/** Califica candidatos con el modelo. null = no disponible (se usa la búsqueda normal). */
export async function aiMatch(query: string, candidates: MatchCandidate[]): Promise<AiResult | null> {
  if (!aiEnabled() || candidates.length === 0) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.openai.apiKey}` },
      body: JSON.stringify({
        model: config.openai.chatModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: buildMatchPrompt(query, candidates),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message.content ?? "";
    const matches = parseMatchResponse(content, candidates);
    return matches ? { matches, intro: parseIntro(content) } : null;
  } catch (err) {
    logger.warn({ err }, "ai match failed, using fast search");
    return null;
  }
}
