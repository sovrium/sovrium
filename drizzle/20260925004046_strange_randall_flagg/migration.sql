CREATE TABLE "system"."admin_digest_snapshots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_digest_snapshots_period_end_idx" ON "system"."admin_digest_snapshots" ("period_end");