import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  real,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { residentsTable } from "./residents";
import { placesTable } from "./places";

/**
 * Cada búsqueda queda registrada para medir si la app funciona
 * y para que las que no tuvieron resultado lleguen al creador.
 */
export const searchesTable = pgTable(
  "searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    residentId: uuid("resident_id").references(() => residentsTable.id),
    query: text("query").notNull(),
    refined: boolean("refined").notNull().default(false),
    refinedQuery: text("refined_query"),
    resultCount: integer("result_count").notNull(),
    topScore: real("top_score"),
    /** Primer lugar contactado por WhatsApp desde esta búsqueda. */
    contactedPlaceId: uuid("contacted_place_id").references(() => placesTable.id, {
      onDelete: "set null",
    }),
    /** El creador ya la atendió a mano. */
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("searches_created_idx").on(t.createdAt)],
);

/** Quejas privadas: nunca se publican, solo las ve el creador. */
export const complaintsTable = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: uuid("place_id")
    .notNull()
    .references(() => placesTable.id, { onDelete: "cascade" }),
  residentId: uuid("resident_id")
    .notNull()
    .references(() => residentsTable.id),
  message: text("message").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
