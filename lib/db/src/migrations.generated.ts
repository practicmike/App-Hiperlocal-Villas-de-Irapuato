// ARCHIVO GENERADO por embed-migrations.mjs. No editar a mano.
export const MIGRATIONS: ReadonlyArray<{ tag: string; statements: readonly string[] }> = [
  {
    "tag": "0000_cultured_mikhail_rasputin",
    "statements": [
      "CREATE TABLE \"access_keys\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_used_at\" timestamp with time zone,\n\t\"revoked_at\" timestamp with time zone,\n\tCONSTRAINT \"access_keys_token_hash_unique\" UNIQUE(\"token_hash\")\n);",
      "CREATE TABLE \"invites\" (\n\t\"code\" text PRIMARY KEY NOT NULL,\n\t\"created_by_id\" uuid NOT NULL,\n\t\"note\" text,\n\t\"used_by_id\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"used_at\" timestamp with time zone\n);",
      "CREATE TABLE \"residents\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"phone\" text NOT NULL,\n\t\"zone\" text,\n\t\"role\" text DEFAULT 'resident' NOT NULL,\n\t\"status\" text DEFAULT 'pending' NOT NULL,\n\t\"invited_by_id\" uuid,\n\t\"invite_code\" text,\n\t\"show_name_on_endorsements\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"approved_at\" timestamp with time zone\n);",
      "CREATE TABLE \"sessions\" (\n\t\"token_hash\" text PRIMARY KEY NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL\n);",
      "CREATE TABLE \"endorsements\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"show_name\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"endorsements_place_resident\" UNIQUE(\"place_id\",\"resident_id\")\n);",
      "CREATE TABLE \"places\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"constellation\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"category\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"contact_name\" text,\n\t\"whatsapp\" text NOT NULL,\n\t\"zone\" text,\n\t\"operation\" text,\n\t\"price_label\" text,\n\t\"image_url\" text,\n\t\"verified\" boolean DEFAULT true NOT NULL,\n\t\"active\" boolean DEFAULT true NOT NULL,\n\t\"boost\" integer DEFAULT 0 NOT NULL,\n\t\"sponsored\" boolean DEFAULT false NOT NULL,\n\t\"embedding\" jsonb,\n\t\"whatsapp_clicks\" integer DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"complaints\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"message\" text NOT NULL,\n\t\"resolved\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"rate_limits\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"count\" integer NOT NULL,\n\t\"reset_at\" timestamp with time zone NOT NULL\n);",
      "CREATE TABLE \"searches\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"resident_id\" uuid,\n\t\"query\" text NOT NULL,\n\t\"refined\" boolean DEFAULT false NOT NULL,\n\t\"refined_query\" text,\n\t\"result_count\" integer NOT NULL,\n\t\"top_score\" real,\n\t\"contacted_place_id\" uuid,\n\t\"handled\" boolean DEFAULT false NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"access_keys\" ADD CONSTRAINT \"access_keys_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"invites\" ADD CONSTRAINT \"invites_created_by_id_residents_id_fk\" FOREIGN KEY (\"created_by_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"invites\" ADD CONSTRAINT \"invites_used_by_id_residents_id_fk\" FOREIGN KEY (\"used_by_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"residents\" ADD CONSTRAINT \"residents_invited_by_id_residents_id_fk\" FOREIGN KEY (\"invited_by_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"sessions\" ADD CONSTRAINT \"sessions_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"endorsements\" ADD CONSTRAINT \"endorsements_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"endorsements\" ADD CONSTRAINT \"endorsements_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"complaints\" ADD CONSTRAINT \"complaints_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"complaints\" ADD CONSTRAINT \"complaints_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"searches\" ADD CONSTRAINT \"searches_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"searches\" ADD CONSTRAINT \"searches_contacted_place_id_places_id_fk\" FOREIGN KEY (\"contacted_place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "CREATE INDEX \"access_keys_resident_idx\" ON \"access_keys\" USING btree (\"resident_id\");",
      "CREATE INDEX \"sessions_resident_idx\" ON \"sessions\" USING btree (\"resident_id\");",
      "CREATE INDEX \"places_constellation_idx\" ON \"places\" USING btree (\"constellation\");",
      "CREATE INDEX \"searches_created_idx\" ON \"searches\" USING btree (\"created_at\");"
    ]
  },
  {
    "tag": "0001_llaves_un_uso",
    "statements": [
      "ALTER TABLE \"access_keys\" ADD COLUMN \"first_used_at\" timestamp with time zone;",
      "ALTER TABLE \"access_keys\" ADD COLUMN \"sessions_created\" integer DEFAULT 0 NOT NULL;",
      "ALTER TABLE \"access_keys\" ADD COLUMN \"rejected_attempts\" integer DEFAULT 0 NOT NULL;",
      "-- Las llaves que ya se abrieron antes de este cambio cuentan como usadas.\nUPDATE \"access_keys\" SET \"first_used_at\" = \"last_used_at\", \"sessions_created\" = 2 WHERE \"last_used_at\" IS NOT NULL;"
    ]
  },
  {
    "tag": "0002_constelaciones",
    "statements": [
      "CREATE TABLE \"constellations\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"hint\" text DEFAULT '' NOT NULL,\n\t\"color\" text NOT NULL,\n\t\"is_property\" boolean DEFAULT false NOT NULL,\n\t\"position\" integer DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "-- Las 5 constelaciones iniciales (opción A: por necesidad).\nINSERT INTO \"constellations\" (\"id\", \"name\", \"hint\", \"color\", \"is_property\", \"position\") VALUES\n  ('hogar',    'Hogar',    'Casas en venta y renta',           '#E6C882', true,  0),\n  ('resolver', 'Resolver', 'Plomería, luz, jardín, limpieza',  '#50e3c2', false, 1),\n  ('antojos',  'Antojos',  'Comida, café y postres',           '#e38fc1', false, 2),\n  ('aprender', 'Aprender', 'Colegios, clases y cursos',        '#7d80d9', false, 3),\n  ('cuidar',   'Cuidar',   'Salud, farmacia y mascotas',       '#ffabab', false, 4)\nON CONFLICT (\"id\") DO NOTHING;",
      "-- Reacomodar las estrellas que ya existen. Primero lo directo:\nUPDATE \"places\" SET \"constellation\" = 'hogar'    WHERE \"constellation\" = 'casas';",
      "UPDATE \"places\" SET \"constellation\" = 'resolver' WHERE \"constellation\" = 'confianza';",
      "-- \"Comercios\" se reparte por giro; lo que no encaje queda en Antojos.\nUPDATE \"places\" SET \"constellation\" = 'aprender' WHERE \"constellation\" = 'comercios'\n  AND (\"category\" ILIKE ANY (ARRAY['%colegio%','%escuela%','%kinder%','%primaria%','%clase%','%curso%','%academia%','%idioma%','%guarder%']));",
      "UPDATE \"places\" SET \"constellation\" = 'cuidar' WHERE \"constellation\" = 'comercios'\n  AND (\"category\" ILIKE ANY (ARRAY['%veterin%','%farmac%','%medic%','%médic%','%dent%','%salud%','%doctor%','%clínic%','%clinic%','%consultorio%','%gimnasio%','%mascota%']));",
      "UPDATE \"places\" SET \"constellation\" = 'resolver' WHERE \"constellation\" = 'comercios'\n  AND (\"category\" ILIKE ANY (ARRAY['%lavander%','%tintor%','%taller%','%ferreter%','%papeler%']));",
      "UPDATE \"places\" SET \"constellation\" = 'antojos' WHERE \"constellation\" = 'comercios';",
      "-- Red de seguridad: cualquier valor desconocido va a Antojos antes de la llave foránea.\nUPDATE \"places\" SET \"constellation\" = 'antojos' WHERE \"constellation\" NOT IN (SELECT \"id\" FROM \"constellations\");",
      "ALTER TABLE \"places\" ADD CONSTRAINT \"places_constellation_constellations_id_fk\" FOREIGN KEY (\"constellation\") REFERENCES \"public\".\"constellations\"(\"id\") ON DELETE no action ON UPDATE cascade;"
    ]
  },
  {
    "tag": "0003_pasaporte",
    "statements": [
      "CREATE TABLE \"merchant_sessions\" (\n\t\"token_hash\" text PRIMARY KEY NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_used_at\" timestamp with time zone\n);",
      "CREATE TABLE \"visits\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"welcome_applied\" boolean DEFAULT false NOT NULL,\n\t\"welcome_offer\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"residents\" ADD COLUMN \"member_code\" text;",
      "ALTER TABLE \"places\" ADD COLUMN \"welcome_offer\" text;",
      "ALTER TABLE \"places\" ADD COLUMN \"merchant_key_hash\" text;",
      "ALTER TABLE \"merchant_sessions\" ADD CONSTRAINT \"merchant_sessions_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"visits\" ADD CONSTRAINT \"visits_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"visits\" ADD CONSTRAINT \"visits_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "CREATE INDEX \"merchant_sessions_place_idx\" ON \"merchant_sessions\" USING btree (\"place_id\");",
      "CREATE INDEX \"visits_resident_idx\" ON \"visits\" USING btree (\"resident_id\");",
      "CREATE INDEX \"visits_place_idx\" ON \"visits\" USING btree (\"place_id\",\"created_at\");",
      "ALTER TABLE \"residents\" ADD CONSTRAINT \"residents_member_code_unique\" UNIQUE(\"member_code\");",
      "ALTER TABLE \"places\" ADD CONSTRAINT \"places_merchant_key_hash_unique\" UNIQUE(\"merchant_key_hash\");"
    ]
  },
  {
    "tag": "0004_fichas",
    "statements": [
      "CREATE TABLE \"place_photos\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"position\" integer DEFAULT 0 NOT NULL,\n\t\"mime\" text NOT NULL,\n\t\"width\" integer NOT NULL,\n\t\"height\" integer NOT NULL,\n\t\"data\" \"bytea\" NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"places\" ADD COLUMN \"kind\" text DEFAULT 'comercio' NOT NULL;",
      "ALTER TABLE \"places\" ADD COLUMN \"delivers\" boolean DEFAULT false NOT NULL;",
      "ALTER TABLE \"places\" ADD COLUMN \"hours\" jsonb;",
      "ALTER TABLE \"places\" ADD COLUMN \"land_m2\" integer;",
      "ALTER TABLE \"places\" ADD COLUMN \"built_m2\" integer;",
      "ALTER TABLE \"places\" ADD COLUMN \"bedrooms\" integer;",
      "ALTER TABLE \"places\" ADD COLUMN \"bathrooms\" real;",
      "ALTER TABLE \"places\" ADD COLUMN \"parking\" integer;",
      "ALTER TABLE \"place_photos\" ADD CONSTRAINT \"place_photos_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"place_photos_place_idx\" ON \"place_photos\" USING btree (\"place_id\",\"position\");"
    ]
  },
  {
    "tag": "0005_hoy",
    "statements": [
      "CREATE TABLE \"news\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"text\" text NOT NULL,\n\t\"photo_mime\" text,\n\t\"photo_data\" \"bytea\",\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL\n);",
      "ALTER TABLE \"places\" ADD COLUMN \"pickup\" boolean DEFAULT false NOT NULL;",
      "ALTER TABLE \"news\" ADD CONSTRAINT \"news_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"news_place_idx\" ON \"news\" USING btree (\"place_id\");",
      "CREATE INDEX \"news_expires_idx\" ON \"news\" USING btree (\"expires_at\");"
    ]
  },
  {
    "tag": "0006_compartir",
    "statements": [
      "CREATE TABLE \"leads\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"source\" text NOT NULL,\n\t\"name\" text,\n\t\"phone\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"places\" ADD COLUMN \"slug\" text;",
      "ALTER TABLE \"leads\" ADD CONSTRAINT \"leads_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"leads_place_idx\" ON \"leads\" USING btree (\"place_id\");",
      "CREATE INDEX \"leads_created_idx\" ON \"leads\" USING btree (\"created_at\");",
      "ALTER TABLE \"places\" ADD CONSTRAINT \"places_slug_unique\" UNIQUE(\"slug\");"
    ]
  }
];
