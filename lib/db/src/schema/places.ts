import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  jsonb,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";

export const CONSTELLATIONS = ["casas", "confianza", "comercios"] as const;
export type Constellation = (typeof CONSTELLATIONS)[number];

/**
 * Cada estrella del universo: una casa, una persona de confianza o un comercio.
 * Solo el creador da de alta lugares en la primera versión.
 */
export const placesTable = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    constellation: text("constellation", { enum: CONSTELLATIONS }).notNull(),
    name: text("name").notNull(),
    /** Giro u oficio: "Plomería", "Tacos", "Casa en renta". */
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    /** Quién atiende: "Don Roberto". */
    contactName: text("contact_name"),
    /** WhatsApp con lada, solo dígitos. Público: es un negocio o un anuncio. */
    whatsapp: text("whatsapp").notNull(),
    zone: text("zone"),
    /** Solo casas. */
    operation: text("operation", { enum: ["venta", "renta"] }),
    priceLabel: text("price_label"),
    imageUrl: text("image_url"),
    /** El creador lo conoce y lo verificó en persona. */
    verified: boolean("verified").notNull().default(true),
    active: boolean("active").notNull().default(true),
    /**
     * Impulso pagado (futuro). Va separado de la relevancia y el ranking
     * lo limita para que nunca tape un resultado mucho más relevante.
     */
    boost: integer("boost").notNull().default(0),
    sponsored: boolean("sponsored").notNull().default(false),
    /** Embedding de text-embedding-3-small; null si no hay OPENAI_API_KEY. */
    embedding: jsonb("embedding").$type<number[] | null>(),
    whatsappClicks: integer("whatsapp_clicks").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("places_constellation_idx").on(t.constellation)],
);

/** "Lo recomiendo": solo vecinos aprobados, uno por vecino y lugar. */
export const endorsementsTable = pgTable(
  "endorsements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id, { onDelete: "cascade" }),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id),
    /** Permiso explícito para mostrar su nombre en esta recomendación. */
    showName: boolean("show_name").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("endorsements_place_resident").on(t.placeId, t.residentId)],
);

export type Place = typeof placesTable.$inferSelect;
export type NewPlace = typeof placesTable.$inferInsert;
