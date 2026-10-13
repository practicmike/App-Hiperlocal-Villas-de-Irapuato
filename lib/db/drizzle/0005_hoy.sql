CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"text" text NOT NULL,
	"photo_mime" text,
	"photo_data" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "pickup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_place_idx" ON "news" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "news_expires_idx" ON "news" USING btree ("expires_at");