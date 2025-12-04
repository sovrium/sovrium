-- Grant permissions to test roles for E2E testing
-- These roles need access to tables, sequences, and schemas to properly test RLS policies

-- Grant schema access (public and auth schemas)
GRANT USAGE ON SCHEMA public TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

GRANT USAGE ON SCHEMA auth TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

-- Grant execute permission on auth schema functions (needed for RLS policies)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

-- Grant table access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

-- Grant sequence access (needed for auto-increment IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO admin_user, member_user, authenticated_user;
--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT EXECUTE ON FUNCTIONS TO admin_user, member_user, authenticated_user;
