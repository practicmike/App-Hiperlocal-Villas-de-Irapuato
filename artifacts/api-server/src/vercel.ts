/**
 * Entrada para Vercel: exporta la app de Express sin abrir un puerto.
 * Vercel la invoca como función en cada petición a /api/*.
 * (En Replit se usa index.ts, que sí llama a listen.)
 */
import app from "./app";

export default app;
