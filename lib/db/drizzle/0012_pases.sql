CREATE TABLE "passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"from_place_id" uuid NOT NULL,
	"to_place_id" uuid NOT NULL,
	"offer" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"from_visit_id" uuid,
	"redeemed_visit_id" uuid,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "partner_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_from_place_id_places_id_fk" FOREIGN KEY ("from_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_to_place_id_places_id_fk" FOREIGN KEY ("to_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_from_visit_id_visits_id_fk" FOREIGN KEY ("from_visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_redeemed_visit_id_visits_id_fk" FOREIGN KEY ("redeemed_visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passes_resident_idx" ON "passes" USING btree ("resident_id","expires_at");--> statement-breakpoint
CREATE INDEX "passes_from_idx" ON "passes" USING btree ("from_place_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "passes_to_idx" ON "passes" USING btree ("to_place_id","redeemed_at");