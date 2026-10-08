ALTER TABLE "system"."automation_runs" ADD COLUMN "resume_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "system"."automation_runs" ADD COLUMN "resume_cursor" jsonb;--> statement-breakpoint
CREATE INDEX "automation_runs_status_resumeAt_idx" ON "system"."automation_runs" ("status","resume_at");