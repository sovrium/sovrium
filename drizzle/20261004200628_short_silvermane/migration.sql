ALTER TABLE "system"."automation_run_steps" ADD COLUMN "reads" jsonb;--> statement-breakpoint
ALTER TABLE "system"."automation_runs" ADD COLUMN "relay" jsonb;