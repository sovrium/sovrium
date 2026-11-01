/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
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
  oauthClientResources as authOauthClientResourcesPg,
} from '@/infrastructure/auth/better-auth/schema'
import { activeDialectKind } from './active-dialect'
import { formSubmissions as formSubmissionsPg } from './schema/form-submissions'
import { fileStorageMetadata as fileStorageMetadataPg } from './schema/storage'
import { oauthClientResources as authOauthClientResourcesSqlite } from './schema-sqlite/auth-oauth-resource-tables'
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

/** The dialect the per-call selectors resolve against, read once from the environment. */
const dialectMemo = new Map<'dialect', 'postgres' | 'sqlite'>()

const resolveDialect = (): 'postgres' | 'sqlite' => {
  // The running layer's dialect first: it was resolved once, at acquire.
  const acquired = activeDialectKind()
  if (acquired !== undefined) return acquired
  const known = dialectMemo.get('dialect')
  if (known !== undefined) return known
  const { dialect } = parseDatabaseDialectConfig(process.env)
  dialectMemo.set('dialect', dialect)
  return dialect
}

/** Whether the active engine is SQLite: the running layer's, or the environment's before it. */
export const isSqliteDialect = (): boolean => resolveDialect() === 'sqlite'

/** What a column stands for in JavaScript, whichever engine stores it. */
type ColumnData<C> = C extends { readonly _: { readonly data: infer Data } } ? Data : never

/** The columns a Drizzle table declares, or nothing for an object that is not one. */
type ColumnsOf<T> = T extends { readonly _: { readonly columns: infer Columns } } ? Columns : never

/**
 * The SQLite twin of a PostgreSQL table object: every column under the same
 * property name, carrying the same JavaScript data type. A column added to one
 * tree and not to the other fails the call that pairs them.
 */
type Compatible<P> = {
  readonly _: {
    readonly columns: {
      readonly [K in keyof ColumnsOf<P>]: {
        readonly _: { readonly data: ColumnData<ColumnsOf<P>[K]> }
      }
    }
  }
}

/**
 * Forget the memoised dialect, so the next selector reads the environment
 * again. Called by `resetDbCache` and only there: the connection it rebuilds
 * and the per-call selectors below must agree on the engine. A table object a
 * repository resolved at module load keeps the engine it was resolved for — a
 * process binds one engine for its life.
 *
 * @internal Test-isolation hook, alongside `resetDbCache`.
 */
export const resetDialectCache = (): void => {
  dialectMemo.clear()
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
 * as if SQLite mode didn't exist. `Compatible` is what makes that claim sound:
 * the SQLite variant must declare every column the PostgreSQL one does, with
 * the same JavaScript data type, or the call fails the typecheck. Dialect
 * resolution memoizes after the first call.
 *
 * Use this generic in new repositories. The per-table `formSubmissionsTable()`
 * / `authUsersTable()` / `authSessionsTable()` selectors below predate this
 * helper and persist because their consumers re-resolve per call (e.g.
 * `.from(authUsersTable())`); the generic is the standard for the module-init
 * resolution pattern used across `src/infrastructure/database/repositories/`.
 */
export const resolveDialectSchema = <P, S extends Compatible<P>>(pg: P, sqlite: S): P =>
  resolveDialect() === 'sqlite' ? (sqlite as unknown as P) : pg

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
export const formSubmissionsTable = (): typeof formSubmissionsPg =>
  resolveDialectSchema(formSubmissionsPg, formSubmissionsSqlite)

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
export const fileStorageMetadataTable = (): typeof fileStorageMetadataPg =>
  resolveDialectSchema(fileStorageMetadataPg, fileStorageMetadataSqlite)

/**
 * The Better Auth `user` (`auth.user` / `auth_user`) Drizzle table object for
 * the active dialect.
 *
 * The Better Auth adapter itself is already dialect-aware, but repositories
 * that hand-write Drizzle query-builder calls against the auth `user` table
 * (e.g. the admin-bootstrap email-verification update) need the dialect-correct
 * object too — otherwise they emit `auth.user`, which does not exist on SQLite.
 */
export const authUsersTable = (): typeof authUsersPg =>
  resolveDialectSchema(authUsersPg, authUsersSqlite)

/**
 * The Better Auth `session` (`auth.session` / `auth_session`) Drizzle table
 * object for the active dialect. Same rationale as {@link authUsersTable}.
 */
export const authSessionsTable = (): typeof authSessionsPg =>
  resolveDialectSchema(authSessionsPg, authSessionsSqlite)

/**
 * The Better Auth `account` (`auth.account` / `auth_account`) Drizzle table
 * object for the active dialect. Same rationale as {@link authUsersTable}.
 *
 * Currently unused by direct Drizzle-query call sites — `account-repository-live.ts`
 * hand-writes raw `auth.account` SQL via `dialect.sql.authTableRef` instead. Kept
 * exported (and marked `@public`) for symmetry with the rest of the
 * Better Auth table family so a future per-account query can adopt the
 * dialect-aware selector without re-introducing it.
 *
 * @public
 */
export const authAccountsTable = (): typeof authAccountsPg =>
  resolveDialectSchema(authAccountsPg, authAccountsSqlite)

/**
 * The Better Auth `verification` (`auth.verification` / `auth_verification`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 *
 * Has no caller today. Kept exported
 * (and marked `@public`) for symmetry with the rest of the Better Auth
 * table family, so a future verification-token query can adopt the
 * dialect-aware selector without re-introducing it.
 *
 * @public
 */
export const authVerificationsTable = (): typeof authVerificationsPg =>
  resolveDialectSchema(authVerificationsPg, authVerificationsSqlite)

/**
 * The Better Auth `team` (`auth.team` / `auth_team`) Drizzle table object for
 * the active dialect. Same rationale as {@link authUsersTable}.
 */
export const authTeamsTable = (): typeof authTeamsPg =>
  resolveDialectSchema(authTeamsPg, authTeamsSqlite)

/**
 * The Better Auth `member` (`auth.member` / `auth_member`) Drizzle table object
 * for the active dialect. Same rationale as {@link authUsersTable}.
 */
export const authMembersTable = (): typeof authMembersPg =>
  resolveDialectSchema(authMembersPg, authMembersSqlite)

/**
 * The Better Auth `team_member` (`auth.team_member` / `auth_team_member`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
export const authTeamMembersTable = (): typeof authTeamMembersPg =>
  resolveDialectSchema(authTeamMembersPg, authTeamMembersSqlite)

/**
 * The Better Auth `organization` (`auth.organization` / `auth_organization`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
export const authOrganizationsTable = (): typeof authOrganizationsPg =>
  resolveDialectSchema(authOrganizationsPg, authOrganizationsSqlite)

/**
 * The Better Auth `oauth_client` (`auth.oauth_client` / `auth_oauth_client`)
 * Drizzle table object for the active dialect. Same rationale as
 * {@link authUsersTable}.
 */
export const authOauthClientsTable = (): typeof authOauthClientsPg =>
  resolveDialectSchema(authOauthClientsPg, authOauthClientsSqlite)

/**
 * The Better Auth `oauth_access_token` (`auth.oauth_access_token` /
 * `auth_oauth_access_token`) Drizzle table object for the active dialect. Same
 * rationale as {@link authUsersTable}.
 */
export const authOauthAccessTokensTable = (): typeof authOauthAccessTokensPg =>
  resolveDialectSchema(authOauthAccessTokensPg, authOauthAccessTokensSqlite)

/**
 * The Better Auth `oauth_client_resource` join table for the active dialect.
 * Both of its columns hold semantic strings — `client_id` is the public OAuth
 * client identifier and `resource_id` the resource identifier URL — not row
 * primary keys. Same rationale as {@link authUsersTable}.
 */
export const authOauthClientResourcesTable = (): typeof authOauthClientResourcesPg =>
  resolveDialectSchema(authOauthClientResourcesPg, authOauthClientResourcesSqlite)
