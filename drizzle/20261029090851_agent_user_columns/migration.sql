ALTER TABLE "auth"."user" ADD COLUMN IF NOT EXISTS "type" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;