CREATE TABLE "auth"."api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"refill_interval" bigint,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" bigint,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
ALTER TABLE "auth"."api_key" ADD CONSTRAINT "api_key_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apiKey_referenceId_idx" ON "auth"."api_key" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "apiKey_configId_idx" ON "auth"."api_key" USING btree ("config_id");