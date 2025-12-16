-- Migration: Rename auth tables with _sovrium_auth_ prefix
-- Purpose: Namespace isolation to prevent conflicts with user-defined tables

-- Step 1: Drop foreign key constraints that reference tables being renamed
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_inviter_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "two_factors" DROP CONSTRAINT IF EXISTS "two_factors_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" DROP CONSTRAINT IF EXISTS "_sovrium_activity_logs_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" DROP CONSTRAINT IF EXISTS "_sovrium_activity_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" DROP CONSTRAINT IF EXISTS "_sovrium_record_comments_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" DROP CONSTRAINT IF EXISTS "_sovrium_record_comments_user_id_users_id_fk";
--> statement-breakpoint

-- Step 2: Rename tables
ALTER TABLE "users" RENAME TO "_sovrium_auth_users";
--> statement-breakpoint
ALTER TABLE "sessions" RENAME TO "_sovrium_auth_sessions";
--> statement-breakpoint
ALTER TABLE "accounts" RENAME TO "_sovrium_auth_accounts";
--> statement-breakpoint
ALTER TABLE "verifications" RENAME TO "_sovrium_auth_verifications";
--> statement-breakpoint
ALTER TABLE "organizations" RENAME TO "_sovrium_auth_organizations";
--> statement-breakpoint
ALTER TABLE "members" RENAME TO "_sovrium_auth_members";
--> statement-breakpoint
ALTER TABLE "invitations" RENAME TO "_sovrium_auth_invitations";
--> statement-breakpoint
ALTER TABLE "api_keys" RENAME TO "_sovrium_auth_api_keys";
--> statement-breakpoint
ALTER TABLE "two_factors" RENAME TO "_sovrium_auth_two_factors";
--> statement-breakpoint

-- Step 3: Recreate foreign key constraints with new table names
ALTER TABLE "_sovrium_auth_sessions" ADD CONSTRAINT "_sovrium_auth_sessions_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_accounts" ADD CONSTRAINT "_sovrium_auth_accounts_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_members" ADD CONSTRAINT "_sovrium_auth_members_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_members" ADD CONSTRAINT "_sovrium_auth_members_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_invitations" ADD CONSTRAINT "_sovrium_auth_invitations_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_invitations" ADD CONSTRAINT "_sovrium_auth_invitations_inviter_id__sovrium_auth_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_api_keys" ADD CONSTRAINT "_sovrium_auth_api_keys_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_auth_two_factors" ADD CONSTRAINT "_sovrium_auth_two_factors_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_activity_logs" ADD CONSTRAINT "_sovrium_activity_logs_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "_sovrium_record_comments" ADD CONSTRAINT "_sovrium_record_comments_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;
