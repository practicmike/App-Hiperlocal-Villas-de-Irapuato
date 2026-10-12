import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { MIGRATIONS } from "./migrations.generated";

const { Pool } = pg;

/**
 * Neon conectado desde el Marketplace de Vercel define DATABASE_URL;
 * algunas integraciones usan POSTGRES_URL. Se acepta cualquiera.
 */
const databaseUrl = process.env["DATABASE_URL"] || process.env["POSTGRES_URL"] || "";

/**
 * Antes, si faltaba la variable, la API entera se caía al arrancar y la web solo
 * decía "No pude conectar". Ahora la API arranca y explica qué falta.
 */
export const databaseConfigError: string | null = databaseUrl
  ? null
  : "Falta la variable DATABASE_URL. Conecta una base Postgres (Neon) al proyecto y vuelve a desplegar.";

/**
 * En Vercel cada función es una instancia aparte: con un pool grande, el tráfico
 * agota las conexiones de Postgres. Ahí se usa 1 conexión por instancia y la URL
 * "pooled" de Neon hace el resto. En Replit (un solo proceso) se usa un pool normal.
 */
const serverless = Boolean(process.env["VERCEL"]);

export const pool = new Pool({
  connectionString: databaseUrl || undefined,
  max: serverless ? 1 : 10,
  idleTimeoutMillis: serverless ? 5_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

/**
 * Crea o actualiza las tablas aplicando las migraciones embebidas que falten.
 * Es idempotente y seguro si dos instancias lo corren a la vez (candado en Postgres).
 */
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(424242)");
    await client.query(
      `create table if not exists "__villas_migrations" (tag text primary key, applied_at timestamptz not null default now())`,
    );
    const done = new Set(
      (await client.query<{ tag: string }>(`select tag from "__villas_migrations"`)).rows.map((r) => r.tag),
    );
    for (const m of MIGRATIONS) {
      if (done.has(m.tag)) continue;
      for (const statement of m.statements) await client.query(statement);
      await client.query(`insert into "__villas_migrations" (tag) values ($1)`, [m.tag]);
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export * from "./schema";
