CREATE TABLE "system"."webhook_outbox" (
	"id" text PRIMARY KEY,
	"table_name" text NOT NULL,
	"webhook_name" text NOT NULL,
	"event" text NOT NULL,
	"record_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"last_http_status" integer,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system"."webhook_outbox_subjects" (
	"outbox_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "webhook_outbox_status_nextAttemptAt_idx" ON "system"."webhook_outbox" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_outbox_tableName_recordId_idx" ON "system"."webhook_outbox" ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "webhook_outbox_subjects_userId_idx" ON "system"."webhook_outbox_subjects" ("user_id");--> statement-breakpoint
CREATE INDEX "webhook_outbox_subjects_outboxId_idx" ON "system"."webhook_outbox_subjects" ("outbox_id");--> statement-breakpoint
ALTER TABLE "system"."webhook_outbox_subjects" ADD CONSTRAINT "webhook_outbox_subjects_outbox_id_webhook_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "system"."webhook_outbox"("id") ON DELETE CASCADE;