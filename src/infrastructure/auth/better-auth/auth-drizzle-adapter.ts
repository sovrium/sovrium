/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import * as authOauthResourceSqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-oauth-resource-tables'
import * as authPasskeySqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-passkey-tables'
import * as authSchemaSqlite from '@/infrastructure/database/drizzle/schema-sqlite/auth-tables'
import { withDriverErrorMessages } from './adapter-errors'
import {
  users,
  sessions,
  accounts,
  verifications,
  twoFactors,
  apiKeys,
  organizations,
  members,
  invitations,
  teams,
  teamMembers,
  jwks,
  oauthClients,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthConsents,
  oauthResources,
  oauthClientResources,
  oauthClientAssertions,
  passkeys,
} from './schema'

/**
 * The Drizzle adapter Better Auth writes through: the auth tables of whichever
 * dialect this process runs on.
 */

/**
 * Schema mapping for Better Auth's drizzle adapter (PostgreSQL).
 *
 * IMPORTANT: The keys MUST be Better Auth's internal model names (user, account, session, etc.)
 * NOT the custom table names. The actual database table name is determined by the Drizzle
 * table definition (e.g., pgTable('_sovrium_auth_users', ...)).
 *
 * This is a critical fix for GitHub issue #5879 - using table names as keys causes
 * the adapter to return wrong records, breaking account linking.
 *
 * See: https://github.com/better-auth/better-auth/issues/5879
 */
const drizzleSchemaPg = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  twoFactor: twoFactors,
  // Model name is `apikey` (one word, no separator) — the plugin's own
  // `API_KEY_TABLE_NAME`. The PHYSICAL table is `auth.api_key`; the key here is
  // what the adapter resolves against (GitHub #5879).
  apikey: apiKeys,
  organization: organizations,
  member: members,
  invitation: invitations,
  team: teams,
  teamMember: teamMembers,
  jwks,
  oauthClient: oauthClients,
  oauthAccessToken: oauthAccessTokens,
  oauthRefreshToken: oauthRefreshTokens,
  oauthConsent: oauthConsents,
  oauthResource: oauthResources,
  oauthClientResource: oauthClientResources,
  oauthClientAssertion: oauthClientAssertions,
  passkey: passkeys,
}

/**
 * Schema mapping for Better Auth's drizzle adapter (SQLite).
 *
 * Exact mirror of `drizzleSchemaPg` — same Better Auth model-name keys — but
 * pointed at the sqlite-core auth tables (`auth_user`, `auth_session`, …) from
 * the parallel `schema-sqlite/` tree. SQLite has no schemas, so the
 * `pgSchema('auth')` namespace is a flat `auth_` table-name prefix instead;
 * `boolean` columns are `integer({ mode: 'boolean' })`. The model-name keys are
 * what the adapter resolves against (GitHub #5879), so they are identical.
 */
const drizzleSchemaSqlite = {
  user: authSchemaSqlite.users,
  session: authSchemaSqlite.sessions,
  account: authSchemaSqlite.accounts,
  verification: authSchemaSqlite.verifications,
  twoFactor: authSchemaSqlite.twoFactors,
  apikey: authSchemaSqlite.apiKeys,
  organization: authSchemaSqlite.organizations,
  member: authSchemaSqlite.members,
  invitation: authSchemaSqlite.invitations,
  team: authSchemaSqlite.teams,
  teamMember: authSchemaSqlite.teamMembers,
  jwks: authSchemaSqlite.jwks,
  oauthClient: authSchemaSqlite.oauthClients,
  oauthAccessToken: authSchemaSqlite.oauthAccessTokens,
  oauthRefreshToken: authSchemaSqlite.oauthRefreshTokens,
  oauthConsent: authSchemaSqlite.oauthConsents,
  oauthResource: authOauthResourceSqlite.oauthResources,
  oauthClientResource: authOauthResourceSqlite.oauthClientResources,
  oauthClientAssertion: authOauthResourceSqlite.oauthClientAssertions,
  passkey: authPasskeySqlite.passkeys,
}

/**
 * Build the Better Auth Drizzle adapter for the active database dialect.
 *
 * The dialect is resolved once via `parseDatabaseDialectConfig()` — the single
 * source of truth shared with `getDb()`:
 *
 *  - PostgreSQL → `provider: 'pg'` + the pg-core auth `schema` map.
 *  - SQLite     → `provider: 'sqlite'` + the sqlite-core auth `schema` map.
 *
 * The `db` value handed to `drizzleAdapter` is the dialect-correct client — the
 * lazy `db` proxy already resolves to either the `bun-sql` or `bun-sqlite`
 * Drizzle client via `getDb()`. `usePlural` stays `false` for both: the schema
 * keys are Better Auth's singular model names and the physical table names live
 * in the Drizzle table definitions.
 *
 * `better-auth`'s `DrizzleAdapterConfig.schema` is typed as
 * `Record<string, any>`, so both the pg-core and sqlite-core table maps satisfy
 * it without a cast — the existing pg call relied on the same loose typing.
 */
export function buildAuthDatabaseAdapter() {
  const { dialect } = parseDatabaseDialectConfig()
  return withDriverErrorMessages(
    dialect === 'postgres'
      ? drizzleAdapter(db, { provider: 'pg', usePlural: false, schema: drizzleSchemaPg })
      : drizzleAdapter(db, { provider: 'sqlite', usePlural: false, schema: drizzleSchemaSqlite })
  )
}

/**
 * Build Better Auth plugins array with custom table names
 *
 * Conditionally includes plugins when enabled in auth configuration.
 * If a plugin is not enabled, its endpoints will not be available (404).
 */
