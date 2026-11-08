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
  },
  {
    "tag": "0007_via",
    "statements": [
      "ALTER TABLE \"leads\" ADD COLUMN \"via\" text DEFAULT 'vendedor' NOT NULL;",
      "ALTER TABLE \"places\" ADD COLUMN \"direct_contact\" boolean DEFAULT false NOT NULL;"
    ]
  },
  {
    "tag": "0008_ubicacion",
    "statements": [
      "ALTER TABLE \"places\" ADD COLUMN \"lat\" real;",
      "ALTER TABLE \"places\" ADD COLUMN \"lng\" real;"
    ]
  },
  {
    "tag": "0009_recomendacion",
    "statements": [
      "ALTER TABLE \"searches\" ADD COLUMN \"suggestion\" text;"
    ]
  },
  {
    "tag": "0010_guardados",
    "statements": [
      "CREATE TABLE \"saved_places\" (\n\t\"resident_id\" uuid NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"saved_places_resident_place\" UNIQUE(\"resident_id\",\"place_id\")\n);",
      "ALTER TABLE \"saved_places\" ADD CONSTRAINT \"saved_places_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"saved_places\" ADD CONSTRAINT \"saved_places_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;"
    ]
  },
  {
    "tag": "0011_fuera_de_villas",
    "statements": [
      "ALTER TABLE \"places\" ADD COLUMN \"outside_villas\" boolean DEFAULT false NOT NULL;"
    ]
  },
  {
    "tag": "0012_pases",
    "statements": [
      "CREATE TABLE \"passes\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"from_place_id\" uuid NOT NULL,\n\t\"to_place_id\" uuid NOT NULL,\n\t\"offer\" text NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"from_visit_id\" uuid,\n\t\"redeemed_visit_id\" uuid,\n\t\"redeemed_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"passes\" ADD CONSTRAINT \"passes_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"passes\" ADD CONSTRAINT \"passes_from_place_id_places_id_fk\" FOREIGN KEY (\"from_place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"passes\" ADD CONSTRAINT \"passes_to_place_id_places_id_fk\" FOREIGN KEY (\"to_place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"passes\" ADD CONSTRAINT \"passes_from_visit_id_visits_id_fk\" FOREIGN KEY (\"from_visit_id\") REFERENCES \"public\".\"visits\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"passes\" ADD CONSTRAINT \"passes_redeemed_visit_id_visits_id_fk\" FOREIGN KEY (\"redeemed_visit_id\") REFERENCES \"public\".\"visits\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"passes_resident_idx\" ON \"passes\" USING btree (\"resident_id\",\"expires_at\");",
      "CREATE INDEX \"passes_from_idx\" ON \"passes\" USING btree (\"from_place_id\",\"redeemed_at\");",
      "CREATE INDEX \"passes_to_idx\" ON \"passes\" USING btree (\"to_place_id\",\"redeemed_at\");"
    ]
  },
  {
    "tag": "0013_kpis",
    "statements": [
      "CREATE TABLE \"contact_events\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"place_id\" uuid NOT NULL,\n\t\"resident_id\" uuid,\n\t\"kind\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"contact_events\" ADD CONSTRAINT \"contact_events_place_id_places_id_fk\" FOREIGN KEY (\"place_id\") REFERENCES \"public\".\"places\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"contact_events\" ADD CONSTRAINT \"contact_events_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "CREATE INDEX \"contact_events_created_idx\" ON \"contact_events\" USING btree (\"created_at\");"
    ]
  },
  {
    "tag": "0014_avisos",
    "statements": [
      "CREATE TABLE \"notice_events\" (\n\t\"notice_id\" uuid NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"kind\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"notice_events_once\" UNIQUE(\"notice_id\",\"resident_id\",\"kind\")\n);",
      "CREATE TABLE \"notice_reports\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"kind\" text NOT NULL,\n\t\"zone\" text,\n\t\"text\" text NOT NULL,\n\t\"status\" text DEFAULT 'pending' NOT NULL,\n\t\"notice_id\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"notices\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"kind\" text NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"body\" text,\n\t\"zone\" text,\n\t\"source\" text NOT NULL,\n\t\"confirmed\" boolean DEFAULT true NOT NULL,\n\t\"expires_at\" timestamp with time zone NOT NULL,\n\t\"closed_at\" timestamp with time zone,\n\t\"created_by_id\" uuid,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"notice_events\" ADD CONSTRAINT \"notice_events_notice_id_notices_id_fk\" FOREIGN KEY (\"notice_id\") REFERENCES \"public\".\"notices\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"notice_events\" ADD CONSTRAINT \"notice_events_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"notice_reports\" ADD CONSTRAINT \"notice_reports_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"notice_reports\" ADD CONSTRAINT \"notice_reports_notice_id_notices_id_fk\" FOREIGN KEY (\"notice_id\") REFERENCES \"public\".\"notices\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"notices\" ADD CONSTRAINT \"notices_created_by_id_residents_id_fk\" FOREIGN KEY (\"created_by_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "CREATE INDEX \"notice_reports_created_idx\" ON \"notice_reports\" USING btree (\"created_at\");",
      "CREATE INDEX \"notices_expires_idx\" ON \"notices\" USING btree (\"expires_at\");"
    ]
  },
  {
    "tag": "0015_push",
    "statements": [
      "CREATE TABLE \"push_prefs\" (\n\t\"resident_id\" uuid PRIMARY KEY NOT NULL,\n\t\"muted\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"quiet_start\" integer,\n\t\"quiet_end\" integer,\n\t\"digest\" boolean DEFAULT true NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"push_subscriptions\" (\n\t\"endpoint\" text PRIMARY KEY NOT NULL,\n\t\"resident_id\" uuid NOT NULL,\n\t\"p256dh\" text NOT NULL,\n\t\"auth\" text NOT NULL,\n\t\"label\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_sent_at\" timestamp with time zone\n);",
      "ALTER TABLE \"push_prefs\" ADD CONSTRAINT \"push_prefs_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"push_subscriptions\" ADD CONSTRAINT \"push_subscriptions_resident_id_residents_id_fk\" FOREIGN KEY (\"resident_id\") REFERENCES \"public\".\"residents\"(\"id\") ON DELETE cascade ON UPDATE no action;"
    ]
  }
];
