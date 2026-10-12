/**
 * Crea (o actualiza) la cuenta del creador y genera su llave personal.
 *
 *   ADMIN_NAME="Miguel Ángel" ADMIN_PHONE=4621234567 pnpm --filter @workspace/scripts run crear-admin
 *
 * Imprime la ruta /llave/<token>. Ábrela en tu teléfono una vez y la sesión queda guardada.
 * Si la vuelves a correr, la llave anterior deja de funcionar.
 */
import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool, residentsTable, accessKeysTable } from "@workspace/db";

const name = process.env["ADMIN_NAME"]?.trim();
const rawPhone = process.env["ADMIN_PHONE"] ?? "";
let phone = rawPhone.replace(/\D/g, "");
if (phone.length === 10) phone = `52${phone}`;

if (!name || phone.length < 12) {
  console.error("Define ADMIN_NAME y ADMIN_PHONE (10 dígitos). Ejemplo en el comentario del archivo.");
  process.exit(1);
}

const [existing] = await db.select().from(residentsTable).where(eq(residentsTable.phone, phone));
const [admin] = existing
  ? await db
      .update(residentsTable)
      .set({ name, role: "admin", status: "approved", approvedAt: existing.approvedAt ?? new Date() })
      .where(eq(residentsTable.id, existing.id))
      .returning()
  : await db
      .insert(residentsTable)
      .values({ name, phone, role: "admin", status: "approved", approvedAt: new Date() })
      .returning();

const token = crypto.randomBytes(32).toString("base64url");
await db
  .update(accessKeysTable)
  .set({ revokedAt: new Date() })
  .where(and(eq(accessKeysTable.residentId, admin!.id), isNull(accessKeysTable.revokedAt)));
await db.insert(accessKeysTable).values({
  residentId: admin!.id,
  tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
});

console.log(`\nCuenta de creador lista: ${admin!.name}`);
console.log(`Tu llave (ábrela en tu dominio): /llave/${token}\n`);
await pool.end();
