/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import {
  users as authUsersPg,
  sessions as authSessionsPg,
  accounts as authAccountsPg,
  verifications as authVerificationsPg,
  teams as authTeamsPg,
  members as authMembersPg,
  teamMembers as authTeamMembersPg,
  organizations as authOrganizationsPg,
  oauthClients as authOauthClientsPg,
  oauthAccessTokens as authOauthAccessTokensPg,
} from '@/infrastructure/auth/better-auth/schema'
import { formSubmissions as formSubmissionsPg } from './schema/form-submissions'
import { fileStorageMetadata as fileStorageMetadataPg } from './schema/storage'
import {
  users as authUsersSqlite,
  sessions as authSessionsSqlite,
  accounts as authAccountsSqlite,
  verifications as authVerificationsSqlite,
  teams as authTeamsSqlite,
  members as authMembersSqlite,
  teamMembers as authTeamMembersSqlite,
  organizations as authOrganizationsSqlite,
  oauthClients as authOauthClientsSqlite,
  oauthAccessTokens as authOauthAccessTokensSqlite,
} from './schema-sqlite/auth-tables'
import { formSubmissions as formSubmissionsSqlite } from './schema-sqlite/form-submissions'
import { fileStorageMetadata as fileStorageMetadataSqlite } from './schema-sqlite/storage'

// eslint-disable-next-line functional/no-let -- module-scope lazy memoization; written once on first call
let CACHED_DIALECT: 'postgres' | 'sqlite' | undefined

const resolveDialect = (): 'postgres' | 'sqlite' => {
  // eslint-disable-next-line functional/no-expression-statements -- memoization cache write
  CACHED_DIALECT ??= parseDatabaseDialectConfig().dialect
  return CACHED_DIALECT
}

/**
 * Pick the dialect-correct variant of a schema object at module-init time.
 *
 * Repositories that consume Drizzle table objects from `schema/` (PostgreSQL,
 * `pgSchema('system')`-qualified) crash with `no such table: system.<x>` under
 * the SQLite default ([[project-sqlite-default-database]]) because the
 * generated SQL is dialect-specific. The PG variant generates
 * `system.<table>` qualifiers; the SQLite variant maps `system_*` flat names
 * via `sqliteTableCreator`.
 *
 * Usage at module top:
 * ```ts
 * import { webhookConfigs as webhookConfigsPg } from '@/infrastructure/database/drizzle/schema/webhook'
 * import { webhookConfigs as webhookConfigsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/webhook'
 *
 * const webhookConfigs = resolveDialectSchema(webhookConfigsPg, webhookConfigsSqlite)
 * ```
 *
 * The return type is `typeof pgVariant`, so column-access autocomplete works
 * as if SQLite mode didn't exist; the runtime structural compatibility of the
 * sqlite-core variant for the query-builder subset (select/insert/update/delete
 * by column) is what makes the cast sound. Dialect resolution memoizes after
 * the first call.
 *
 * Use this generic in new repositories. The per-table `formSubmissionsTable()`
 * / `authUsersTable()` / `authSessionsTable()` selectors below predate this
 * helper and persist because their consumers re-resolve per call (e.g.
 * `.from(authUsersTable())`); the generic is the standard for the module-init
 * resolution pattern used across `src/infrastructure/database/repositories/`.
 */
export const resolveDialectSchema = <T>(pg: T, sqlite: unknown): T =>
  resolveDialect() === 'sqlite' ? (sqlite as T) : pg

/**
 * Dialect-aware Drizzle schema-object selectors.
 *
 * The `schema/` (pg-core) and `schema-sqlite/` (sqlite-core) trees export
 * structurally-parallel table objects under the same names. A repository that
 * runs Drizzle query-builder calls against a *fixed* schema object would emit
 * the wrong table name on the non-default dialect — most visibly the PostgreSQL
 * `system.form_submissions` schema-qualified name, which SQLite (no schemas)
 * stores as the flat `system_form_submissions`.
 *
 * These selectors return the table object that matches the active dialect, so
 * a repository's query builder always targets the correct physical table.
 * Column *property* names are identical across the two mirrors, so the result
 * type is the PostgreSQL table (the structural superset) — callers stay
 * dialect-agnostic. The sqlite-core object is structurally compatible at the
 * call sites that use it (insert/select/update on shared columns).
 */

/**
 * The `system.form_submissions` (PostgreSQL) / `system_form_submissions`
 * (SQLite) Drizzle table object for the active dialect.
 *
 * SQLite has no schemas — the `system` namespace is a flat `system_` table
 * prefix. Selecting the dialect-correct object here is what makes a form
 * submission insert resolve to a table that actually exists on SQLite.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const formSubmissionsTable = (): typeof formSubmissionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (formSubmissionsSqlite as unknown as typeof formSubmissionsPg)
    : formSubmissionsPg

/**
 * The `system.file_storage_metadata` (PostgreSQL) / `system_file_storage_metadata`
 * (SQLite) Drizzle table object for the active dialect.
 *
 * Backs the admin bucket file-browser read (`GET
 * /api/admin/buckets/:bucketName/files`). SQLite has no schemas — the `system`
 * namespace is a flat `system_` table prefix — so selecting the dialect-correct
 * object here is what makes the file-metadata enumeration resolve to a table
 * that actually exists on SQLite. Same rationale as {@link formSubmissionsTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const fileStorageMetadataTable = (): typeof fileStorageMetadataPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (fileStorageMetadataSqlite as unknown as typeof fileStorageMetadataPg)
    : fileStorageMetadataPg

/**
 * The Better Auth `user` (`auth.user` / `auth_user`) Drizzle table object for
 * the active dialect.
 *
 * The Better Auth adapter itself is already dialect-aware, but repositories
 * that hand-write Drizzle query-builder calls against the auth `user` table
 * (e.g. the admin-bootstrap email-verification update) need the dialect-correct
 * object too — otherwise they emit `auth.user`, which does not exist on SQLite.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authUsersTable = (): typeof authUsersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authUsersSqlite as unknown as typeof authUsersPg)
    : authUsersPg

/**
 * The Better Auth `session` (`auth.session` / `auth_session`) Drizzle table
 * object for the active dialect. Same rationale as {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authSessionsTable = (): typeof authSessionsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authSessionsSqlite as unknown as typeof authSessionsPg)
    : authSessionsPg

/**
 * The Better Auth `account` (`auth.account` / `auth_account`) Drizzle table
 * object for the active dialect. Same rationale as {@link authUsersTable}.
 *
 * Currently unused by direct Drizzle-query call sites — `account.ts:222-299`
 * hand-writes raw `auth.account` SQL via {@link authTableRef} instead. Kept
 * exported (and marked `@public`) for symmetry with the rest of the
 * Better Auth table family so a future per-account query can adopt the
 * dialect-aware selector without re-introducing it.
 *
 * @public
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authAccountsTable = (): typeof authAccountsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authAccountsSqlite as unknown as typeof authAccountsPg)
    : authAccountsPg

/**
 * The Better Auth `verification` (`auth.verification` / `auth_verification`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 *
 * Has no caller today — the invitation handler that read it was removed
 * along with the rest of the unreferenced route-setup code. Kept exported
 * (and marked `@public`) for symmetry with the rest of the Better Auth
 * table family, so a future verification-token query can adopt the
 * dialect-aware selector without re-introducing it.
 *
 * @public
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authVerificationsTable = (): typeof authVerificationsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authVerificationsSqlite as unknown as typeof authVerificationsPg)
    : authVerificationsPg

/**
 * The Better Auth `team` (`auth.team` / `auth_team`) Drizzle table object for
 * the active dialect. Same rationale as {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authTeamsTable = (): typeof authTeamsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authTeamsSqlite as unknown as typeof authTeamsPg)
    : authTeamsPg

/**
 * The Better Auth `member` (`auth.member` / `auth_member`) Drizzle table object
 * for the active dialect. Same rationale as {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authMembersTable = (): typeof authMembersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authMembersSqlite as unknown as typeof authMembersPg)
    : authMembersPg

/**
 * The Better Auth `team_member` (`auth.team_member` / `auth_team_member`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authTeamMembersTable = (): typeof authTeamMembersPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authTeamMembersSqlite as unknown as typeof authTeamMembersPg)
    : authTeamMembersPg

/**
 * The Better Auth `organization` (`auth.organization` / `auth_organization`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authOrganizationsTable = (): typeof authOrganizationsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOrganizationsSqlite as unknown as typeof authOrganizationsPg)
    : authOrganizationsPg

/**
 * The Better Auth `oauth_client` (`auth.oauth_client` / `auth_oauth_client`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authOauthClientsTable = (): typeof authOauthClientsPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOauthClientsSqlite as unknown as typeof authOauthClientsPg)
    : authOauthClientsPg

/**
 * The Better Auth `oauth_access_token` (`auth.oauth_access_token` /
 * `auth_oauth_access_token`) Drizzle table object for the active dialect. Same
 * rationale as {@link authUsersTable}.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- a Drizzle table object is the upstream-mutable shape; the query builder reads it without mutating, same rationale as getDb()'s return in db-bun.ts
export const authOauthAccessTokensTable = (): typeof authOauthAccessTokensPg =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? (authOauthAccessTokensSqlite as unknown as typeof authOauthAccessTokensPg)
    : authOauthAccessTokensPg

/**
 * Build a raw-SQL fragment that references a Better Auth table by name, picking
 * the dialect-correct physical qualifier:
 *
 *   - Postgres: `auth.<name>` (the `pgSchema('auth')` qualifier).
 *   - SQLite:   `auth_<name>` (the flat-prefix mirror produced by `authTable`).
 *
 * Used by `presentation/api/routes/account.ts`-style sites that hand-write
 * `sql\`SELECT … FROM auth.user …\`` paths and need to interpolate the table
 * reference without losing dialect awareness. The accepted names match the set
 * of Better Auth tables Sovrium hand-queries from raw SQL.
 */
export const authTableRef = (
  name:
    | 'user'
    | 'session'
    | 'account'
    | 'team'
    | 'member'
    | 'team_member'
    | 'oauth_client'
    | 'oauth_access_token'
    | 'verification'
  // eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's `sql.raw()` returns the native mutable `SQL` shape; wrapping in `Readonly<>` breaks raw template interpolation `sql\`SELECT … FROM ${authTableRef('user')}\``. Same rationale as the aggregation-helpers cast helpers.
): SQL =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(`auth_${name}`)
    : sql.raw(`auth.${name}`)
