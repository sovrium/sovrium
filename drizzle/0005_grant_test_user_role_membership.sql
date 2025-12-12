-- Grant test user the ability to SET ROLE to test roles
-- This allows E2E tests to switch between roles using SET ROLE
-- The test user (from DATABASE_URL) needs membership in these roles to use SET ROLE

-- Grant role membership to allow SET ROLE
GRANT admin_user TO test;
--> statement-breakpoint

GRANT member_user TO test;
--> statement-breakpoint

GRANT authenticated_user TO test;
--> statement-breakpoint
