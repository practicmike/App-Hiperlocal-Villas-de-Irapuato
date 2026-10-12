/**
 * Función serverless de Vercel para todo /api/*.
 *
 * Vercel no compila bien los paquetes TypeScript del monorepo (@workspace/*),
 * así que el build empaqueta la API completa en un solo archivo JS
 * (artifacts/api-server/dist/vercel.mjs) y aquí solo se reexporta.
 */
export { default } from "../artifacts/api-server/dist/vercel.mjs";
