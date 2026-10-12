import { config, aiEnabled } from "./config";
import { logger } from "./logger";

const OPENAI = "https://api.openai.com/v1";

async function openai<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPENAI}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Caché pequeña: la misma búsqueda no se paga dos veces. */
const queryCache = new Map<string, number[]>();

export async function embed(text: string): Promise<number[] | null> {
  if (!aiEnabled()) return null;
  const key = text.trim().toLowerCase();
  const cached = queryCache.get(key);
  if (cached) return cached;
  try {
    const data = await openai<{ data: Array<{ embedding: number[] }> }>("/embeddings", {
      model: config.openai.embeddingModel,
      input: key,
    });
    const vector = data.data[0]?.embedding ?? null;
    if (vector) {
      if (queryCache.size > 300) queryCache.delete(queryCache.keys().next().value!);
      queryCache.set(key, vector);
    }
    return vector;
  } catch (err) {
    logger.warn({ err }, "embedding failed, falling back to keywords");
    return null;
  }
}

/**
 * Embeddings de varios textos en UNA sola llamada (la API acepta listas).
 * Más rápido y barato que llamar una vez por lugar al cargar muchos.
 */
export async function embedMany(texts: string[]): Promise<Array<number[] | null>> {
  if (!aiEnabled() || texts.length === 0) return texts.map(() => null);
  try {
    const data = await openai<{ data: Array<{ index: number; embedding: number[] }> }>("/embeddings", {
      model: config.openai.embeddingModel,
      input: texts.map((t) => t.trim().toLowerCase()),
    });
    const out: Array<number[] | null> = texts.map(() => null);
    for (const d of data.data) out[d.index] = d.embedding;
    return out;
  } catch (err) {
    logger.warn({ err }, "batch embedding failed, places stay keyword-searchable");
    return texts.map(() => null);
  }
}

export interface Refinement {
  query: string;
  constellation: "casas" | "confianza" | "comercios" | null;
}

/**
 * "Refinar con IA": interpreta lo que el vecino escribió y lo convierte
 * en palabras de búsqueda más precisas y, si es obvio, en una constelación.
 */
export async function refineQuery(raw: string): Promise<Refinement | null> {
  if (!aiEnabled()) return null;
  try {
    const data = await openai<{ choices: Array<{ message: { content: string } }> }>(
      "/chat/completions",
      {
        model: config.openai.chatModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres el buscador de una guía vecinal de Villas de Irapuato (México). " +
              "Hay tres grupos: 'casas' (inmuebles en venta o renta), 'confianza' (oficios y servicios: plomería, electricidad, jardinería, limpieza, etc.) " +
              "y 'comercios' (restaurantes, comida a domicilio, colegios, tiendas). " +
              "Convierte la petición en JSON {\"query\": string, \"constellation\": \"casas\"|\"confianza\"|\"comercios\"|null}. " +
              "'query' son 3 a 8 palabras clave en español, sin acentos, incluyendo el oficio o giro probable y sinónimos. " +
              "Usa constellation solo si es evidente.",
          },
          { role: "user", content: raw.slice(0, 200) },
        ],
      },
    );
    const parsed = JSON.parse(data.choices[0]?.message.content ?? "{}") as Partial<Refinement>;
    const constellation =
      parsed.constellation === "casas" ||
      parsed.constellation === "confianza" ||
      parsed.constellation === "comercios"
        ? parsed.constellation
        : null;
    const query = typeof parsed.query === "string" && parsed.query.trim() ? parsed.query : raw;
    return { query: query.slice(0, 200), constellation };
  } catch (err) {
    logger.warn({ err }, "refine failed");
    return null;
  }
}

/**
 * "Ayúdame a decirlo": propone 2–3 formas más claras de expresar lo que el
 * vecino necesita, usando de preferencia los giros que sí existen en Villas.
 * No busca ni inventa lugares: solo ayuda a expresarse; el vecino elige.
 */
export async function suggestPhrasings(raw: string, categories: string[]): Promise<string[] | null> {
  if (!aiEnabled()) return null;
  try {
    const data = await openai<{ choices: Array<{ message: { content: string } }> }>(
      "/chat/completions",
      {
        model: config.openai.chatModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Ayudas a vecinos de Villas de Irapuato (México) a expresar lo que necesitan en una guía de casas, oficios y comercios del fraccionamiento. " +
              "Reescribe lo que el vecino escribió en 2 o 3 frases cortas (máximo 7 palabras cada una), claras y en español de México, " +
              "que nombren el oficio, giro o tipo de inmueble que probablemente necesita. " +
              "Usa de preferencia estos giros, que sí existen en la guía: " + categories.slice(0, 60).join(", ") + ". " +
              "No inventes nombres de negocios ni precios. Si la petición ya es clara, mejórala poco. " +
              'Responde JSON: {"suggestions": ["…", "…"]}',
          },
          { role: "user", content: raw.slice(0, 200) },
        ],
      },
    );
    const parsed = JSON.parse(data.choices[0]?.message.content ?? "{}") as { suggestions?: unknown };
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return list
      .filter((x): x is string => typeof x === "string" && x.trim().length > 1)
      .map((x) => x.trim().slice(0, 80))
      .slice(0, 3);
  } catch (err) {
    logger.warn({ err }, "suggest failed");
    return null;
  }
}
