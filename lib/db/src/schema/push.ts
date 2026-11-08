import { pgTable, text, uuid, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";

/**
 * Notificaciones push SOLO para el creador (los vecinos no reciben push).
 * Un registro por teléfono o navegador donde el creador las activó.
 */
export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residentsTable.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** "Android · Chrome", para reconocer el dispositivo en el panel. */
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
});

/** Qué quiere recibir el creador y cuándo no molestarlo. */
export const pushPrefsTable = pgTable("push_prefs", {
  residentId: uuid("resident_id")
    .primaryKey()
    .references(() => residentsTable.id, { onDelete: "cascade" }),
  /** Tipos apagados (por defecto todos encendidos). */
  muted: jsonb("muted").$type<string[]>().notNull().default([]),
  /** Horario silencioso en hora de Irapuato; null = sin horario. */
  quietStart: integer("quiet_start"),
  quietEnd: integer("quiet_end"),
  digest: boolean("digest").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
