ALTER TABLE "auth"."device_code" ADD COLUMN "redirect_uri" text;--> statement-breakpoint
ALTER TABLE "auth"."device_code" ADD COLUMN "device_name" text;--> statement-breakpoint
ALTER TABLE "auth"."device_code" ADD COLUMN "return_code_hash" text;--> statement-breakpoint
ALTER TABLE "auth"."device_code" ADD COLUMN "requested_at" timestamp with time zone;