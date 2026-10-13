ALTER TABLE "leads" ADD COLUMN "via" text DEFAULT 'vendedor' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "direct_contact" boolean DEFAULT false NOT NULL;