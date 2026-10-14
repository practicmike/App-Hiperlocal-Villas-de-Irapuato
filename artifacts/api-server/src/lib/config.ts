/** Configuración por variables de entorno, leída en un solo lugar. */
const env = process.env;

export const config = {
  isProduction: env["NODE_ENV"] === "production",
  creator: {
    name: env["CREATOR_NAME"] ?? "Miguel",
    whatsapp: (env["CREATOR_WHATSAPP"] ?? "").replace(/\D/g, ""),
    message:
      env["CREATOR_MESSAGE"] ??
      "Hola, soy Miguel, vecino de Villas. Hice esta guía para que encontremos gente y negocios de confianza entre nosotros. Si necesitas algo, escríbeme.",
    photoUrl: env["CREATOR_PHOTO_URL"] ?? null,
  },
  openai: {
    apiKey: env["OPENAI_API_KEY"] ?? "",
    embeddingModel: env["OPENAI_EMBEDDING_MODEL"] ?? "text-embedding-3-small",
    chatModel: env["OPENAI_CHAT_MODEL"] ?? "gpt-4o-mini",
    transcribeModel: env["OPENAI_TRANSCRIBE_MODEL"] ?? "gpt-4o-mini-transcribe",
  },
  sessionDays: 180,
};

export const aiEnabled = () => config.openai.apiKey.length > 0;
