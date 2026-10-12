// Copia las migraciones SQL de ./drizzle a src/migrations.generated.ts.
// Así viajan dentro del código empaquetado: no dependen de que el hosting
// copie archivos sueltos (Vercel no siempre lo hace).
// Se corre solo con `pnpm --filter @workspace/db run generate`.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const journal = JSON.parse(readFileSync(path.join(here, "drizzle/meta/_journal.json"), "utf8"));

const migrations = journal.entries.map((e) => ({
  tag: e.tag,
  statements: readFileSync(path.join(here, "drizzle", `${e.tag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean),
}));

writeFileSync(
  path.join(here, "src/migrations.generated.ts"),
  `// ARCHIVO GENERADO por embed-migrations.mjs. No editar a mano.\n` +
    `export const MIGRATIONS: ReadonlyArray<{ tag: string; statements: readonly string[] }> = ${JSON.stringify(migrations, null, 2)};\n`,
);
console.log(`Migraciones embebidas: ${migrations.map((m) => m.tag).join(", ")}`);
