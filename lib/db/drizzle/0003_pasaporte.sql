CREATE TABLE "merchant_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"place_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"welcome_applied" boolean DEFAULT false NOT NULL,
	"welcome_offer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "residents" ADD COLUMN "member_code" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "welcome_offer" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "merchant_key_hash" text;--> statement-breakpoint
ALTER TABLE "merchant_sessions" ADD CONSTRAINT "merchant_sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_sessions_place_idx" ON "merchant_sessions" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "visits_resident_idx" ON "visits" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "visits_place_idx" ON "visits" USING btree ("place_id","created_at");--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_member_code_unique" UNIQUE("member_code");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_merchant_key_hash_unique" UNIQUE("merchant_key_hash");