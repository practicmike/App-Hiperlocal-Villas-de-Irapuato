CREATE TABLE "notice_events" (
	"notice_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notice_events_once" UNIQUE("notice_id","resident_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notice_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"zone" text,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"zone" text,
	"source" text NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notice_events" ADD CONSTRAINT "notice_events_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_events" ADD CONSTRAINT "notice_events_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_resident_id_residents_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_reports" ADD CONSTRAINT "notice_reports_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_id_residents_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."residents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notice_reports_created_idx" ON "notice_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notices_expires_idx" ON "notices" USING btree ("expires_at");