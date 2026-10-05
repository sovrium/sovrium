CREATE TABLE "system"."automation_run_refs" (
	"run_id" text,
	"table_name" text,
	"record_id" text,
	CONSTRAINT "automation_run_refs_pkey" PRIMARY KEY("run_id","table_name","record_id")
);
--> statement-breakpoint
ALTER TABLE "system"."automation_runs" ADD COLUMN "values_erased_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "automation_run_refs_record_idx" ON "system"."automation_run_refs" ("table_name","record_id");--> statement-breakpoint
ALTER TABLE "system"."automation_run_refs" ADD CONSTRAINT "automation_run_refs_run_id_automation_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "system"."automation_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "system"."automation_run_refs" ("run_id", "table_name", "record_id") SELECT "id", '', '' FROM "system"."automation_runs";