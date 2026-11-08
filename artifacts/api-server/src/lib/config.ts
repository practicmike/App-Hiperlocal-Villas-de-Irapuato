/** Configuración por variables de entorno, leída en un solo lugar. */
const env = process.env;

export const config = {
  isProduction: env["NODE_ENV"] === "production",
  creator: {
    name: env["CREATOR_NAME"] ?? "Mike",
    whatsapp: (env["CREATOR_WHATSAPP"] ?? "").replace(/\D/g, ""),
    message:
      env["CREATOR_MESSAGE"] ??
      "Hola, soy Mike, vecino de Villas. Hice esta guía para que encontremos gente y negocios de confianza entre nosotros. Si necesitas algo, escríbeme.",
    photoUrl: env["CREATOR_PHOTO_URL"] ?? null,
  },
  openai: {
    apiKey: env["OPENAI_API_KEY"] ?? "",
    embeddingModel: env["OPENAI_EMBEDDING_MODEL"] ?? "text-embedding-3-small",
    chatModel: env["OPENAI_CHAT_MODEL"] ?? "gpt-4o-mini",
    transcribeModel: env["OPENAI_TRANSCRIBE_MODEL"] ?? "gpt-4o-mini-transcribe",
  },
  sessionDays: 180,
  /** Supuestos de los KPIs. Se cambian en Vercel sin tocar código. */
  kpis: {
    /** Hogares en Villas (estimado). Base de la penetración. */
    households: Math.max(1, Number(env["HOGARES_VILLAS"]) || 1600),
    /** Ticket promedio en MXN para estimar venta por visita. */
    avgTicket: Math.max(0, Number(env["TICKET_PROMEDIO"]) || 250),
  },
};

export const aiEnabled = () => config.openai.apiKey.length > 0;
