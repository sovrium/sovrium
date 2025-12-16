CREATE TABLE "_sovrium_activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"table_id" text NOT NULL,
	"record_id" text NOT NULL,
	"changes" jsonb,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "_sovrium_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_org_created_at_idx" ON "_sovrium_activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_created_at_idx" ON "_sovrium_activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_table_record_idx" ON "_sovrium_activity_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "_sovrium_activity_logs" USING btree ("action");