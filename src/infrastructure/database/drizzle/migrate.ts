/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect, Console } from 'effect'

/**
 * Create Better Auth tables if they don't exist
 *
 * This manually creates the Better Auth tables:
 * - users
 * - sessions
 * - accounts
 * - verifications
 * - organizations
 * - members
 * - invitations
 * - api_keys
 * - two_factors
 *
 * CRITICAL: Must run BEFORE initializeSchema() because:
 * 1. User fields (created-by, updated-by, user) need users table to exist
 * 2. The users table must be created before app-specific tables
 * 3. initializeSchema() creates app-specific tables that reference users
 *
 * @param databaseUrl - PostgreSQL connection URL
 * @returns Effect that completes when tables are created
 */
// eslint-disable-next-line max-lines-per-function -- Table creation requires comprehensive SQL setup
export const runMigrations = (databaseUrl: string): Effect.Effect<void, Error> =>
  // eslint-disable-next-line max-lines-per-function -- Generator function needs to handle all table creation
  Effect.gen(function* () {
    yield* Console.log('[runMigrations] Ensuring Better Auth tables exist...')

    // Run table creation wrapped in Effect.tryPromise for proper async handling
    yield* Effect.tryPromise({
      // eslint-disable-next-line max-lines-per-function -- All Better Auth tables must be created atomically
      try: async () => {
        const db = new SQL(databaseUrl)

        try {
          // eslint-disable-next-line max-lines-per-function -- Transaction must include all table creation statements
          await db.begin(async (tx) => {
            // Create tables using raw SQL (IF NOT EXISTS prevents errors)
            // This is the content from drizzle/0000_harsh_dazzler.sql and drizzle/0001_zippy_speed_demon.sql

            // Base Better Auth tables
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS accounts (
                id text PRIMARY KEY NOT NULL,
                account_id text NOT NULL,
                provider_id text NOT NULL,
                user_id text NOT NULL,
                access_token text,
                refresh_token text,
                id_token text,
                access_token_expires_at timestamp with time zone,
                refresh_token_expires_at timestamp with time zone,
                scope text,
                password text,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL
              )
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS sessions (
                id text PRIMARY KEY NOT NULL,
                expires_at timestamp with time zone NOT NULL,
                token text NOT NULL UNIQUE,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL,
                ip_address text,
                user_agent text,
                user_id text NOT NULL,
                impersonated_by text,
                active_organization_id text
              )
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS users (
                id text PRIMARY KEY NOT NULL,
                name text NOT NULL,
                email text NOT NULL UNIQUE,
                email_verified boolean DEFAULT false NOT NULL,
                image text,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL,
                role text,
                banned boolean,
                ban_reason text,
                ban_expires timestamp with time zone,
                two_factor_enabled boolean
              )
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS verifications (
                id text PRIMARY KEY NOT NULL,
                identifier text NOT NULL,
                value text NOT NULL,
                expires_at timestamp with time zone NOT NULL,
                created_at timestamp with time zone,
                updated_at timestamp with time zone
              )
            `)

            // Organization plugin tables
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS organizations (
                id text PRIMARY KEY NOT NULL,
                name text NOT NULL,
                slug text NOT NULL UNIQUE,
                logo text,
                metadata text,
                created_at timestamp with time zone DEFAULT now() NOT NULL
              )
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS members (
                id text PRIMARY KEY NOT NULL,
                organization_id text NOT NULL,
                user_id text NOT NULL,
                role text NOT NULL,
                created_at timestamp with time zone DEFAULT now() NOT NULL
              )
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS invitations (
                id text PRIMARY KEY NOT NULL,
                organization_id text NOT NULL,
                email text NOT NULL,
                role text NOT NULL,
                status text NOT NULL,
                expires_at timestamp with time zone NOT NULL,
                inviter_id text NOT NULL,
                created_at timestamp with time zone DEFAULT now() NOT NULL
              )
            `)

            // API Key plugin table
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS api_keys (
                id text PRIMARY KEY NOT NULL,
                name text,
                start text,
                prefix text,
                key text NOT NULL,
                user_id text NOT NULL,
                refill_interval integer,
                refill_amount integer,
                last_refill_at timestamp with time zone,
                enabled boolean NOT NULL DEFAULT true,
                rate_limit_enabled boolean NOT NULL DEFAULT false,
                rate_limit_time_window integer,
                rate_limit_max integer,
                request_count integer NOT NULL DEFAULT 0,
                remaining integer,
                last_request timestamp with time zone,
                expires_at timestamp with time zone,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL,
                permissions text,
                metadata text
              )
            `)

            // Two-factor plugin table
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE TABLE IF NOT EXISTS two_factors (
                id text PRIMARY KEY NOT NULL,
                user_id text NOT NULL,
                secret text,
                backup_codes text
              )
            `)

            // Add foreign key constraints (only if they don't exist)
            // Note: We can't use IF NOT EXISTS for constraints, but ALTER TABLE will fail silently if they exist
            // So we wrap in DO blocks to check first
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'accounts_user_id_users_id_fk'
                ) THEN
                  ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_users_id_fk
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'sessions_user_id_users_id_fk'
                ) THEN
                  ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_users_id_fk
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'invitations_organization_id_organizations_id_fk'
                ) THEN
                  ALTER TABLE invitations ADD CONSTRAINT invitations_organization_id_organizations_id_fk
                    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'invitations_inviter_id_users_id_fk'
                ) THEN
                  ALTER TABLE invitations ADD CONSTRAINT invitations_inviter_id_users_id_fk
                    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'members_organization_id_organizations_id_fk'
                ) THEN
                  ALTER TABLE members ADD CONSTRAINT members_organization_id_organizations_id_fk
                    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'members_user_id_users_id_fk'
                ) THEN
                  ALTER TABLE members ADD CONSTRAINT members_user_id_users_id_fk
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'api_keys_user_id_users_id_fk'
                ) THEN
                  ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_users_id_fk
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              DO $$
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.table_constraints
                  WHERE constraint_name = 'two_factors_user_id_users_id_fk'
                ) THEN
                  ALTER TABLE two_factors ADD CONSTRAINT two_factors_user_id_users_id_fk
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade;
                END IF;
              END$$;
            `)

            // Create auth schema for helper functions
            // eslint-disable-next-line functional/no-expression-statements -- Migration side effect required
            await tx.unsafe(`
              CREATE SCHEMA IF NOT EXISTS auth
            `)

            // Create auth.is_authenticated() function
            // Returns true if app.user_id session variable is set
             
            await tx.unsafe(`
              CREATE OR REPLACE FUNCTION auth.is_authenticated()
              RETURNS boolean AS $$
              BEGIN
                RETURN current_setting('app.user_id', true) IS NOT NULL
                  AND current_setting('app.user_id', true) != '';
              EXCEPTION
                WHEN OTHERS THEN
                  RETURN false;
              END;
              $$ LANGUAGE plpgsql STABLE;
            `)

            // Create auth.user_has_role() function
            // Checks if the current user has the specified role
             
            await tx.unsafe(`
              CREATE OR REPLACE FUNCTION auth.user_has_role(role_name text)
              RETURNS boolean AS $$
              BEGIN
                RETURN current_setting('app.user_role', true) = role_name;
              EXCEPTION
                WHEN OTHERS THEN
                  RETURN false;
              END;
              $$ LANGUAGE plpgsql STABLE;
            `)
          })
        } finally {
          // eslint-disable-next-line functional/no-expression-statements -- Cleanup side effect required
          await db.close()
        }
      },
      catch: (error) => new Error(`Table creation failed: ${String(error)}`),
    })

    yield* Console.log('[runMigrations] ✓ Better Auth tables ready')
  })
