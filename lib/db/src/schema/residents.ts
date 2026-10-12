import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Vecinos de Villas. Nunca se muestran como puntos en el universo:
 * solo existen para dar acceso, firmar recomendaciones y enviar quejas privadas.
 */
export const residentsTable = pgTable("residents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** WhatsApp con lada, solo dígitos. Nunca se expone a otros vecinos. */
  phone: text("phone").notNull(),
  /** Privada o sección dentro de Villas, texto libre. */
  zone: text("zone"),
  role: text("role", { enum: ["resident", "admin"] }).notNull().default("resident"),
  status: text("status", { enum: ["pending", "approved", "blocked"] })
    .notNull()
    .default("pending"),
  invitedById: uuid("invited_by_id").references((): AnyPgColumn => residentsTable.id),
  inviteCode: text("invite_code"),
  /** Permiso para mostrar su nombre junto a sus recomendaciones. */
  showNameOnEndorsements: boolean("show_name_on_endorsements").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

/** Códigos de invitación de un solo uso. */
export const invitesTable = pgTable("invites", {
  code: text("code").primaryKey(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => residentsTable.id),
  /** Para quién es, como recordatorio del creador. */
  note: text("note"),
  usedById: uuid("used_by_id").references(() => residentsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

/**
 * Llave personal: link que el creador entrega por WhatsApp.
 * Se guarda solo el hash SHA-256; el token en claro nunca se almacena.
 */
export const accessKeysTable = pgTable(
  "access_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("access_keys_resident_idx").on(t.residentId)],
);

/** Sesiones del navegador; también se guarda solo el hash. */
export const sessionsTable = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_resident_idx").on(t.residentId)],
);

export type Resident = typeof residentsTable.$inferSelect;
export type Invite = typeof invitesTable.$inferSelect;
