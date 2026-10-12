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

export interface ConstellationSuggestion {
  constellation: string | null;
  category: string | null;
  reason: string | null;
}

/**
 * Al dar de alta una estrella: sugiere a qué constelación pertenece y un giro
 * corto. El creador siempre confirma; la IA nunca mueve estrellas sola.
 */
export async function suggestConstellation(
  place: { name: string; category: string; description: string },
  constellations: Array<{ id: string; name: string; hint: string }>,
  existingCategories: string[],
): Promise<ConstellationSuggestion | null> {
  if (!aiEnabled() || constellations.length === 0) return null;
  try {
    const data = await openai<{ choices: Array<{ message: { content: string } }> }>("/chat/completions", {
      model: config.openai.chatModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Organizas una guía vecinal de Villas de Irapuato (México). Constelaciones disponibles:\n" +
            constellations.map((c) => `- ${c.id}: ${c.name} (${c.hint})`).join("\n") +
            "\nElige la constelación que mejor responde a la necesidad del vecino que buscaría esta estrella. " +
            "Propón un giro corto (1 a 3 palabras), reutilizando de preferencia uno de estos si aplica: " +
            existingCategories.slice(0, 80).join(", ") +
            '. Responde JSON: {"constellation": "<id>", "category": "<giro>", "reason": "<máx 10 palabras>"}',
        },
        {
          role: "user",
          content: `Nombre: ${place.name}\nGiro escrito: ${place.category}\nDescripción: ${place.description.slice(0, 1000)}`,
        },
      ],
    });
    const parsed = JSON.parse(data.choices[0]?.message.content ?? "{}") as Partial<Record<keyof ConstellationSuggestion, unknown>>;
    const ids = new Set(constellations.map((c) => c.id));
    const constellation = typeof parsed.constellation === "string" && ids.has(parsed.constellation) ? parsed.constellation : null;
    const category = typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim().slice(0, 60) : null;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 100) : null;
    return { constellation, category, reason };
  } catch (err) {
    logger.warn({ err }, "suggestConstellation failed");
    return null;
  }
}
