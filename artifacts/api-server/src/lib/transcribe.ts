/**
 * Voz → texto para la búsqueda.
 * - El celular graba unos segundos y manda el audio tal cual (webm en Android, mp4 en iPhone).
 * - Se le pasa a OpenAI una "pista" con los nombres y giros de Villas, para que
 *   entienda "Tacos Don Chuy" o "impermeabilizar" en vez de inventar palabras parecidas.
 */
import { config, aiEnabled } from "./config";
import { logger } from "./logger";

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export const audioExt = (mime: string | undefined) => EXT[(mime ?? "").split(";")[0]!.trim().toLowerCase()] ?? null;

export async function transcribe(audio: Buffer, mime: string, hint: string): Promise<string | null> {
  if (!aiEnabled()) return null;
  const ext = audioExt(mime);
  if (!ext) return null;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime.split(";")[0]! }), `voz.${ext}`);
  form.append("model", config.openai.transcribeModel);
  form.append("language", "es");
  form.append("response_format", "json");
  form.append("prompt", hint.slice(0, 800));
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${config.openai.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`OpenAI transcribe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim().replace(/\s+/g, " ").slice(0, 400);
  } catch (err) {
    logger.warn({ err }, "transcripción falló");
    return null;
  }
}
