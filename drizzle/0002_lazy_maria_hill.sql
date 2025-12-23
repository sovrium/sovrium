CREATE TABLE "_sovrium_auth_organization_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permissions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
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
ALTER TABLE "_sovrium_auth_invitations" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_sessions" ADD COLUMN "active_team_id" text;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_organization_roles" ADD CONSTRAINT "_sovrium_auth_organization_roles_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_team_members" ADD CONSTRAINT "_sovrium_auth_team_members_team_id__sovrium_auth_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."_sovrium_auth_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_team_members" ADD CONSTRAINT "_sovrium_auth_team_members_user_id__sovrium_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."_sovrium_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "_sovrium_auth_teams" ADD CONSTRAINT "_sovrium_auth_teams_organization_id__sovrium_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."_sovrium_auth_organizations"("id") ON DELETE cascade ON UPDATE no action;