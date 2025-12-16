CREATE TABLE "_sovrium_record_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"record_id" text NOT NULL,
	"table_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" DROP CONSTRAINT "_sovrium_activity_logs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" DROP CONSTRAINT "_sovrium_activity_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_comments_record_created_idx" ON "_sovrium_record_comments" USING btree ("table_id","record_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_org_created_idx" ON "_sovrium_record_comments" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_user_created_idx" ON "_sovrium_record_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_deleted_at_idx" ON "_sovrium_record_comments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "record_comments_org_user_idx" ON "_sovrium_record_comments" USING btree ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;