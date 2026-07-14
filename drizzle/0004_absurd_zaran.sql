ALTER TABLE "auth"."two_factor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ADD COLUMN "locked_until" timestamp with time zone;