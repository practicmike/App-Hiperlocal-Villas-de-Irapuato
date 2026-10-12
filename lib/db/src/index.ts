import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * En Vercel cada función es una instancia aparte: con un pool grande, el tráfico
 * agota las conexiones de Postgres. Ahí se usa 1 conexión por instancia y la URL
 * "pooled" de Neon hace el resto. En Replit (un solo proceso) se usa un pool normal.
 */
const serverless = Boolean(process.env.VERCEL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: serverless ? 1 : 10,
  idleTimeoutMillis: serverless ? 5_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
