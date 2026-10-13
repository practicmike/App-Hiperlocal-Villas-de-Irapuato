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
  real,
  customType,
} from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";

/**
 * Constelaciones: los grandes grupos del universo. Las decide el creador
 * (no la IA) para que el mapa sea estable y los vecinos lo aprendan de memoria.
 */
export const constellationsTable = pgTable("constellations", {
  /** Identificador corto y estable (hogar, resolver…); no cambia al renombrar. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Frase corta bajo el nombre: "casas en venta y renta". */
  hint: text("hint").notNull().default(""),
  color: text("color").notNull(),
  /** Inmuebles: activa venta/renta y precio en sus estrellas. */
  isProperty: boolean("is_property").notNull().default(false),
  /** Orden alrededor de "Tú", empezando arriba y en sentido del reloj. */
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Imagen en la base: a la escala de Villas (cientos de fotos) evita depender de otro servicio. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** Horario de un día; close menor que open = cierra pasada la medianoche. */
export interface DayHours {
  open: string;
  close: string;
}
/** 7 días, de domingo (0) a sábado (6); null = cerrado ese día. */
export type WeekHours = Array<DayHours | null>;

/** Máximo recomendado: más de 6 alrededor de "Tú" se enciman en un celular. */
export const MAX_CONSTELLATIONS = 6;

/**
 * Cada estrella del universo: una casa, una persona de confianza o un comercio.
 * Solo el creador da de alta lugares en la primera versión.
 */
export const placesTable = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    constellation: text("constellation")
      .notNull()
      .references(() => constellationsTable.id, { onUpdate: "cascade" }),
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
    /** comercio = el vecino va; oficio = la persona va a tu casa (plomero, maestra). */
    kind: text("kind", { enum: ["comercio", "oficio"] }).notNull().default("comercio"),
    /** Entrega o atiende a domicilio. */
    delivers: boolean("delivers").notNull().default(false),
    /** null = sin horario capturado. */
    hours: jsonb("hours").$type<WeekHours | null>(),
    // Solo inmuebles.
    landM2: integer("land_m2"),
    builtM2: integer("built_m2"),
    bedrooms: integer("bedrooms"),
    bathrooms: real("bathrooms"),
    parking: integer("parking"),
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
    /** Beneficio para la primera visita desde el universo: "Primer café 2x1". */
    welcomeOffer: text("welcome_offer"),
    /** Hash del link del modo comercio; null = sin modo comercio. */
    merchantKeyHash: text("merchant_key_hash").unique(),
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

/**
 * Visita registrada: el comercio escaneó la credencial del vecino.
 * Es lo que enciende la estrella en el cielo de ese vecino.
 */
export const visitsTable = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id, { onDelete: "cascade" }),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => residentsTable.id),
    /** Se aplicó el beneficio de bienvenida en esta visita (solo la primera). */
    welcomeApplied: boolean("welcome_applied").notNull().default(false),
    welcomeOffer: text("welcome_offer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("visits_resident_idx").on(t.residentId),
    index("visits_place_idx").on(t.placeId, t.createdAt),
  ],
);

/** Fotos de una estrella; la primera (position menor) es la portada. */
export const placePhotosTable = pgTable(
  "place_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("place_photos_place_idx").on(t.placeId, t.position)],
);
export const MAX_PHOTOS = 5;

/** Teléfonos del comercio con el modo comercio abierto (solo el hash). */
export const merchantSessionsTable = pgTable(
  "merchant_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => placesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("merchant_sessions_place_idx").on(t.placeId)],
);

export type Place = typeof placesTable.$inferSelect;
export type NewPlace = typeof placesTable.$inferInsert;
export type Visit = typeof visitsTable.$inferSelect;
export type ConstellationRow = typeof constellationsTable.$inferSelect;
