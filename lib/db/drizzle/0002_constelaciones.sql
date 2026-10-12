CREATE TABLE "constellations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"is_property" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Las 5 constelaciones iniciales (opción A: por necesidad).
INSERT INTO "constellations" ("id", "name", "hint", "color", "is_property", "position") VALUES
  ('hogar',    'Hogar',    'Casas en venta y renta',           '#E6C882', true,  0),
  ('resolver', 'Resolver', 'Plomería, luz, jardín, limpieza',  '#50e3c2', false, 1),
  ('antojos',  'Antojos',  'Comida, café y postres',           '#e38fc1', false, 2),
  ('aprender', 'Aprender', 'Colegios, clases y cursos',        '#7d80d9', false, 3),
  ('cuidar',   'Cuidar',   'Salud, farmacia y mascotas',       '#ffabab', false, 4)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Reacomodar las estrellas que ya existen. Primero lo directo:
UPDATE "places" SET "constellation" = 'hogar'    WHERE "constellation" = 'casas';
--> statement-breakpoint
UPDATE "places" SET "constellation" = 'resolver' WHERE "constellation" = 'confianza';
--> statement-breakpoint
-- "Comercios" se reparte por giro; lo que no encaje queda en Antojos.
UPDATE "places" SET "constellation" = 'aprender' WHERE "constellation" = 'comercios'
  AND ("category" ILIKE ANY (ARRAY['%colegio%','%escuela%','%kinder%','%primaria%','%clase%','%curso%','%academia%','%idioma%','%guarder%']));
--> statement-breakpoint
UPDATE "places" SET "constellation" = 'cuidar' WHERE "constellation" = 'comercios'
  AND ("category" ILIKE ANY (ARRAY['%veterin%','%farmac%','%medic%','%médic%','%dent%','%salud%','%doctor%','%clínic%','%clinic%','%consultorio%','%gimnasio%','%mascota%']));
--> statement-breakpoint
UPDATE "places" SET "constellation" = 'resolver' WHERE "constellation" = 'comercios'
  AND ("category" ILIKE ANY (ARRAY['%lavander%','%tintor%','%taller%','%ferreter%','%papeler%']));
--> statement-breakpoint
UPDATE "places" SET "constellation" = 'antojos' WHERE "constellation" = 'comercios';
--> statement-breakpoint
-- Red de seguridad: cualquier valor desconocido va a Antojos antes de la llave foránea.
UPDATE "places" SET "constellation" = 'antojos' WHERE "constellation" NOT IN (SELECT "id" FROM "constellations");
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_constellation_constellations_id_fk" FOREIGN KEY ("constellation") REFERENCES "public"."constellations"("id") ON DELETE no action ON UPDATE cascade;