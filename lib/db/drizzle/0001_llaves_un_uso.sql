ALTER TABLE "access_keys" ADD COLUMN "first_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_keys" ADD COLUMN "sessions_created" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_keys" ADD COLUMN "rejected_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Las llaves que ya se abrieron antes de este cambio cuentan como usadas.
UPDATE "access_keys" SET "first_used_at" = "last_used_at", "sessions_created" = 2 WHERE "last_used_at" IS NOT NULL;