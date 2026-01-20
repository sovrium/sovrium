ALTER TABLE "auth"."invitation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."member" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."role" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."organization" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."team_member" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth"."team" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "auth"."invitation" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."member" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."role" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."organization" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."team_member" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."team" CASCADE;--> statement-breakpoint
DROP INDEX "system"."activity_logs_org_created_at_idx";--> statement-breakpoint
DROP INDEX "system"."record_comments_org_created_idx";--> statement-breakpoint
DROP INDEX "system"."record_comments_org_user_idx";--> statement-breakpoint
ALTER TABLE "auth"."session" DROP COLUMN "active_organization_id";--> statement-breakpoint
ALTER TABLE "auth"."session" DROP COLUMN "active_team_id";--> statement-breakpoint
ALTER TABLE "system"."activity_logs" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "system"."record_comments" DROP COLUMN "organization_id";