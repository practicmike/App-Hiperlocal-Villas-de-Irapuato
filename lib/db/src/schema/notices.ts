import { pgTable, text, uuid, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";

/** Tipos de aviso de servicio. «calle» lo ven todos (afecta al que pasa, no al que vive ahí). */
export const NOTICE_KINDS = ["agua", "luz", "calle", "general"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/**
 * Avisos generales a los vecinos: corte de agua, apagón, calle cerrada...
 * Los publica el creador, o se publican solos cuando varios vecinos reportan
 * lo mismo en la misma zona (confirmed = false hasta que el creador lo confirme).
 * Caducan solos en expiresAt.
 */
export const noticesTable = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: NOTICE_KINDS }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Privada o sección afectada; null = toda Villas. Se compara normalizado con residents.zone. */
    zone: text("zone"),
    /** De dónde salió: "JAPAMI", "CFE", "Reportado por 3 vecinos"... Siempre visible. */
    source: text("source").notNull(),
    /** false = auto-publicado por reportes de vecinos, sin confirmar por el creador. */
    confirmed: boolean("confirmed").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Cerrado antes de tiempo ("ya regresó el agua"). */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => residentsTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notices_expires_idx").on(t.expiresAt)],
);

/** Lo que reporta un vecino. No se publica directo: llega al panel del creador. */
export const noticeReportsTable = pgTable(
  "notice_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: NOTICE_KINDS }).notNull(),
    zone: text("zone"),
    text: text("text").notNull(),
    status: text("status", { enum: ["pending", "published", "dismissed"] })
      .notNull()
      .default("pending"),
    /** Aviso que se publicó a partir de este reporte. */
    noticeId: uuid("notice_id").references(() => noticesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notice_reports_created_idx").on(t.createdAt)],
);

/** Vistas y compartidas por vecino (una de cada una por aviso), para los KPIs. */
export const noticeEventsTable = pgTable(
  "notice_events",
  {
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => noticesTable.id, { onDelete: "cascade" }),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["view", "share"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("notice_events_once").on(t.noticeId, t.residentId, t.kind)],
);

export type Notice = typeof noticesTable.$inferSelect;
export type NoticeReport = typeof noticeReportsTable.$inferSelect;
