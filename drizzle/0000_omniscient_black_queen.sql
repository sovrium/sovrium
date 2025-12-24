CREATE TABLE "_sovrium_auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_organization_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permissions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "_sovrium_auth_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"active_team_id" text,
	CONSTRAINT "_sovrium_auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text,
	"backup_codes" text
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean,
	CONSTRAINT "_sovrium_auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "_sovrium_auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "_sovrium_migration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb,
	"applied_at" timestamp DEFAULT now(),
	"rolled_back_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "_sovrium_migration_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"from_version" integer,
	"to_version" integer,
	"reason" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "_sovrium_schema_checksum" (
	"id" text PRIMARY KEY NOT NULL,
	"checksum" text NOT NULL,
	"schema" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "_sovrium_activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text,
	"user_id" text,
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
ALTER TABLE "_sovrium_auth_accounts" ADD CONSTRAINT "_sovrium_auth_accounts_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_api_keys" ADD CONSTRAINT "_sovrium_auth_api_keys_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_invitations" ADD CONSTRAINT "_sovrium_auth_invitations_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_invitations" ADD CONSTRAINT "_sovrium_auth_invitations_inviter_id__sovrium_auth_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_members" ADD CONSTRAINT "_sovrium_auth_members_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_members" ADD CONSTRAINT "_sovrium_auth_members_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_organization_roles" ADD CONSTRAINT "_sovrium_auth_organization_roles_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_sessions" ADD CONSTRAINT "_sovrium_auth_sessions_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_team_members" ADD CONSTRAINT "_sovrium_auth_team_members_team_id__sovrium_auth_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."_sovrium_auth_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_team_members" ADD CONSTRAINT "_sovrium_auth_team_members_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_teams" ADD CONSTRAINT "_sovrium_auth_teams_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_two_factors" ADD CONSTRAINT "_sovrium_auth_two_factors_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "_sovrium_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_org_created_at_idx" ON "_sovrium_activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_created_at_idx" ON "_sovrium_activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_table_record_idx" ON "_sovrium_activity_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "_sovrium_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "record_comments_record_created_idx" ON "_sovrium_record_comments" USING btree ("table_id","record_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_org_created_idx" ON "_sovrium_record_comments" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_user_created_idx" ON "_sovrium_record_comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "record_comments_deleted_at_idx" ON "_sovrium_record_comments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "record_comments_org_user_idx" ON "_sovrium_record_comments" USING btree ("organization_id","user_id");