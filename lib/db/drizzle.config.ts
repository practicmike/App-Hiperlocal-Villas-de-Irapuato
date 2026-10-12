import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Migraciones SQL versionadas: producción las aplica desde /setup.
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
