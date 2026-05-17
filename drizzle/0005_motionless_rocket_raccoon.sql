CREATE TABLE "system"."sovrium_app_drafts" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"base_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."sovrium_app_versions" (
	"version_number" serial PRIMARY KEY NOT NULL,
	"snapshot" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"restored_from_version" integer
);
--> statement-breakpoint
CREATE TABLE "system"."sovrium_bootstrap_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."sovrium_preview_sessions" (
	"preview_id" text PRIMARY KEY NOT NULL,
	"port" integer NOT NULL,
	"draft_snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'starting' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
