CREATE TABLE "system"."links" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"source" text DEFAULT 'db' NOT NULL,
	"destination" text,
	"targets" jsonb,
	"title" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"max_clicks" integer,
	"expired_to" text,
	"utm" jsonb,
	"password_hash" text,
	"disabled_at" timestamp with time zone,
	"shadowed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "links_app_slug_unique" ON "system"."links" USING btree ("app_name","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "links_app_archived_idx" ON "system"."links" USING btree ("app_name","archived_at");--> statement-breakpoint
CREATE INDEX "links_deleted_at_idx" ON "system"."links" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "analytics_events_app_type_name_idx" ON "system"."analytics_events" USING btree ("app_name","event_type","event_name");