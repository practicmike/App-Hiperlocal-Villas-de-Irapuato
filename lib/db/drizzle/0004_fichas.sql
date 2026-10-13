CREATE TABLE "place_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "kind" text DEFAULT 'comercio' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "delivers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "hours" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "land_m2" integer;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "built_m2" integer;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "bedrooms" integer;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "bathrooms" real;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "parking" integer;--> statement-breakpoint
ALTER TABLE "place_photos" ADD CONSTRAINT "place_photos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_photos_place_idx" ON "place_photos" USING btree ("place_id","position");