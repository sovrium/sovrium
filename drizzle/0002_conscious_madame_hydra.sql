CREATE TABLE "system"."page_views" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"app_name" text DEFAULT 'test-app' NOT NULL,
	"page_path" text NOT NULL,
	"page_title" text,
	"visitor_hash" text NOT NULL,
	"session_hash" text DEFAULT 'default-session' NOT NULL,
	"is_entrance" boolean DEFAULT false NOT NULL,
	"referrer_url" text,
	"referrer_domain" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"device_type" text,
	"browser_name" text,
	"os_name" text,
	"language" text,
	"screen_width" smallint,
	"screen_height" smallint
);
--> statement-breakpoint
CREATE INDEX "analytics_pv_app_timestamp_idx" ON "system"."page_views" USING btree ("app_name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_pv_app_visitor_timestamp_idx" ON "system"."page_views" USING btree ("app_name","visitor_hash","created_at");--> statement-breakpoint
CREATE INDEX "analytics_pv_app_path_timestamp_idx" ON "system"."page_views" USING btree ("app_name","page_path","created_at");--> statement-breakpoint
CREATE INDEX "analytics_pv_app_referrer_idx" ON "system"."page_views" USING btree ("app_name","referrer_domain");--> statement-breakpoint
CREATE INDEX "analytics_pv_app_utm_source_idx" ON "system"."page_views" USING btree ("app_name","utm_source");--> statement-breakpoint
CREATE INDEX "analytics_pv_app_device_idx" ON "system"."page_views" USING btree ("app_name","device_type");