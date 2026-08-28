CREATE TABLE "system"."connection_app_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system"."connection_app_tokens" ADD CONSTRAINT "connection_app_tokens_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "system"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connection_app_tokens_connection_unique" ON "system"."connection_app_tokens" USING btree ("connection_id");