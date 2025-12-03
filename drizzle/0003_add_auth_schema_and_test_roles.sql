-- Create auth schema for permission helper functions
CREATE SCHEMA IF NOT EXISTS auth;
--> statement-breakpoint

-- Helper function to check if current user has a specific role
-- Used in RLS policies: auth.user_has_role('admin')
-- Reads from app.user_role session variable set by application layer
CREATE OR REPLACE FUNCTION auth.user_has_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.user_role', true), '') = role_name
$$;
--> statement-breakpoint

-- Helper function to check if current user is authenticated
-- Used in RLS policies: auth.is_authenticated()
-- Reads from app.user_id session variable set by application layer
CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true) IS NOT NULL
    AND current_setting('app.user_id', true) != ''
$$;
--> statement-breakpoint

-- Create test roles for E2E testing
-- These roles are used with SET ROLE in tests to simulate different permission levels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
    CREATE ROLE admin_user;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'member_user') THEN
    CREATE ROLE member_user;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_user') THEN
    CREATE ROLE authenticated_user;
  END IF;
END
$$;
