CREATE TABLE "system"."design_system_shares" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" text DEFAULT 'default' NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "design_system_shares_token_hash_unique" ON "system"."design_system_shares" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "design_system_shares_app_revoked_idx" ON "system"."design_system_shares" USING btree ("app_name","revoked_at");