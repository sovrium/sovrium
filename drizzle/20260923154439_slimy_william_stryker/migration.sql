ALTER TABLE "system"."connection_app_tokens" ADD COLUMN "token_fields" text;--> statement-breakpoint
ALTER TABLE "system"."connection_app_tokens" ADD COLUMN "grant_fingerprint" text;--> statement-breakpoint
ALTER TABLE "system"."connection_tokens" ADD COLUMN "token_fields" text;