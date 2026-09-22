CREATE TABLE "system"."boot_ledger" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"app_name" text DEFAULT 'default' NOT NULL,
	"app_version" text,
	"engine_version" text NOT NULL,
	"prev_engine_version" text,
	"config_hash" text NOT NULL,
	"prev_config_hash" text,
	"booted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"booted_by" text,
	"summary" text NOT NULL,
	"stats" jsonb NOT NULL,
	"engine_migrations" jsonb NOT NULL,
	"derived_ddl" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "boot_ledger_app_booted_at_idx" ON "system"."boot_ledger" ("app_name","booted_at");