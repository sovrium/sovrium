CREATE TABLE "_sovrium_migration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb,
	"applied_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "_sovrium_migration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"from_version" integer,
	"to_version" integer,
	"reason" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "_sovrium_schema_checksum" (
	"id" text PRIMARY KEY NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb NOT NULL
);
