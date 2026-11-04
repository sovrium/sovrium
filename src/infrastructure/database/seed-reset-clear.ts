/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a reset of the app to its seed clears besides the app's own tables and
 * accounts: what the engine keeps against a record, what a visitor leaves in
 * the app's system tables, the sign-in material of every account it keeps
 * (before its baseline, if it has one, is put back), and the stored files
 * nothing names any more.
 *
 * Each list below is a stage of {@link RESET_CLEAR_STAGES}; which table is in
 * which stage, and why every other system and auth table is left alone, is
 * the census in `seed-reset-coverage.ts`, held against the Drizzle schema by
 * its test. A table is cleared in the order its stage lists it, children
 * before the rows they point at.
 */

import { sql } from 'drizzle-orm'
import { Effect, type Context } from 'effect'
import {
  UNATTRIBUTED_BUCKET,
  type StorageError,
  type StorageService,
} from '@/application/ports/services/storage-service'
import { isSignatureEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import {
  PLATFORM_SSO_PROVIDER_ID,
  SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR,
} from '@/domain/models/process-env/platform-sso'
import { preBindOrigin } from '@/domain/models/process-env/server'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import {
  authExists,
  describeFailure,
  isSqlite,
  storedFalse,
  systemExists,
} from './seed-reset-statements'
import type { DatabaseService, Dialect } from '@/infrastructure/database/drizzle/layer'
import type { SQL } from 'drizzle-orm'

/** What a stage's predicate may depend on: the app's tables, as bound values. */
interface ClearScope {
  readonly appTables: SQL
}

/** One table a stage clears, and which of its rows. */
type Clear = readonly [table: string, where: (scope: ClearScope, dialect: Dialect) => SQL]

const all = (): SQL => sql`1 = 1`

/**
 * What the engine keeps against a user-table record: comments and who read
 * them, the activity history, the search index, AI-computed values and the
 * per-record grants. Every user table is emptied, so none of it points at
 * anything any more.
 */
const RECORD_SCOPED: readonly Clear[] = [
  ['record_comments', all],
  ['comment_read_state', all],
  ['activity_logs', ({ appTables }) => sql`table_name IN (${appTables})`],
  ['search_index', ({ appTables }) => sql`table_name IN (${appTables})`],
  ['ai_field_cache', ({ appTables }) => sql`table_name IN (${appTables})`],
  ['ai_compute_status', ({ appTables }) => sql`table_name IN (${appTables})`],
  ['user_access', ({ appTables }) => sql`table_slug IN (${appTables})`],
]

/** What a visitor leaves in the system tables: form submissions and conversations with an assistant. */
const VISITOR_DATA: readonly Clear[] = [
  ['form_submissions', all],
  ['ai_tool_calls', all],
  ['ai_messages', all],
  ['ai_chat_attachments', all],
  ['ai_conversations', all],
]

/**
 * The small settings an account gathers, which a reset returns to their
 * defaults, baseline or not: notification channels and the inbox (which names
 * records the reset emptied), favourites and recently viewed items of every
 * kind, which records were read, and presence.
 */
const PERSONAL_SETTINGS: readonly Clear[] = [
  ['notification_preferences', all],
  ['notifications', all],
  ['user_favorites', all],
  ['user_recent_items', all],
  ['read_state', all],
  ['user_presence', all],
]

/**
 * A token the app obtained with a connection's own client credentials: a cache
 * the engine obtains again on its next call, never a credential anyone gave.
 */
const ENGINE_CACHES: readonly Clear[] = [
  ['connection_app_tokens', () => sql`grant_fingerprint IS NOT NULL`],
]

/** The Sovrium Cloud subject the host binds its owner to, if it names one. */
export const platformAdminSubject = (): string | undefined => {
  const subject = Bun.env[SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR]?.trim() ?? ''
  return subject === '' ? undefined : subject
}

/**
 * The `account` rows that are the platform administrator's Sovrium Cloud link
 * — host configuration a reset never removes, baseline or not: without it the
 * owner could never sign in with Sovrium Cloud again.
 */
export const platformAdminCloudLink = (): SQL => {
  const subject = platformAdminSubject()
  return subject === undefined
    ? sql`1 = 0`
    : sql`provider_id = ${PLATFORM_SSO_PROVIDER_ID} AND account_id = ${subject}`
}

/**
 * The confidential client the engine registers for its own MCP resource server
 * at boot (`mcpResourceServerCredentials` in the auth infrastructure). Host
 * configuration with no owner: a reset keeps it, or the MCP endpoint would
 * refuse every bearer until the next restart.
 */
const ENGINE_OAUTH_CLIENT_ID = 'sovrium-mcp-resource-server'

/**
 * The sign-in rows a kept account carries apart from its password and, for
 * the platform administrator, its Sovrium Cloud link — and the OAuth clients
 * with no account behind them and the spent client assertions, which no reset
 * can attribute to anyone.
 */
const SIGN_IN_MATERIAL: readonly Clear[] = [
  ['api_key', all],
  ['oauth_access_token', all],
  ['oauth_refresh_token', all],
  ['oauth_consent', all],
  ['oauth_client_assertion', all],
  ['oauth_client', () => sql`client_id <> ${ENGINE_OAUTH_CLIENT_ID}`],
  [
    'oauth_client_resource',
    (_scope, dialect) =>
      sql`client_id NOT IN (SELECT client_id FROM ${dialect.sql.authTableRef('oauth_client')})`,
  ],
  ['passkey', all],
  ['two_factor', all],
  ['device_code', all],
  ['verification', all],
  ['account', () => sql`provider_id <> 'credential' AND NOT (${platformAdminCloudLink()})`],
]

/** The system half of a kept account's sign-in material: its calendar feeds. */
const SIGN_IN_FEEDS: readonly Clear[] = [['calendar_feed_tokens', all]]

/**
 * The resource the engine declares for its MCP endpoint and seeds once per
 * process: the server's origin and `/mcp`, derived as `mcpResourceIdentifier`
 * in the auth infrastructure derives it. Removed, every MCP token would name
 * an audience the server no longer knows until the next restart.
 */
const engineOAuthResource = (): string => `${preBindOrigin(Bun.env)}/mcp`

/** Every OAuth resource no remaining client links to, but the one the engine declares. */
const UNLINKED_OAUTH_RESOURCES: readonly Clear[] = [
  [
    'oauth_resource',
    (_scope, dialect) => sql`identifier <> ${engineOAuthResource()}
            AND identifier NOT IN (SELECT resource_id FROM ${dialect.sql.authTableRef('oauth_client_resource')})`,
  ],
]

/** A stage: the namespace its tables live in, and the tables it clears in order. */
export interface ClearStage {
  readonly namespace: 'auth' | 'system'
  readonly clears: readonly Clear[]
}

/** Every stage a reset clears with, by name: the census names a cleared table's stage. */
export const RESET_CLEAR_STAGES = {
  'record-scoped': { namespace: 'system', clears: RECORD_SCOPED },
  'visitor-data': { namespace: 'system', clears: VISITOR_DATA },
  'personal-settings': { namespace: 'system', clears: PERSONAL_SETTINGS },
  'engine-caches': { namespace: 'system', clears: ENGINE_CACHES },
  'sign-in-material': { namespace: 'auth', clears: SIGN_IN_MATERIAL },
  'sign-in-feeds': { namespace: 'system', clears: SIGN_IN_FEEDS },
  'unlinked-oauth-resources': { namespace: 'auth', clears: UNLINKED_OAUTH_RESOURCES },
} as const satisfies Readonly<Record<string, ClearStage>>

/** The name of a clear stage. */
export type ClearStageName = keyof typeof RESET_CLEAR_STAGES

/** Run `DELETE … WHERE` on each table of the stages that exists; a table never created holds nothing. */
const clearStages = async (
  database: DatabaseService,
  names: readonly ClearStageName[],
  scope: ClearScope
): Promise<void> => {
  const steps = names.flatMap((name) => {
    const stage: ClearStage = RESET_CLEAR_STAGES[name]
    return stage.clears.map(([table, where]) => ({ namespace: stage.namespace, table, where }))
  })
  await steps.reduce<Promise<void>>(
    (previous, { namespace, table, where }) =>
      previous.then(async () => {
        const exists = namespace === 'auth' ? authExists : systemExists
        if (!(await exists(database, table))) return
        const ref =
          namespace === 'auth'
            ? database.dialect.sql.authTableRef(table)
            : database.dialect.sql.systemTableRef(table)
        await executeRawOn(
          database.dialect.kind,
          database.client,
          sql`DELETE FROM ${ref} WHERE ${where(scope, database.dialect)}`
        ).catch((error: unknown) => {
          throw new Error(`reset could not clear ${table}: ${describeFailure(error)}`)
        })
      }),
    Promise.resolve()
  )
}

/**
 * Remove every system row kept against a record of the app's tables, every
 * visitor's data, every account's small settings and the engine's caches.
 */
export const clearRecordScopedRows = (
  database: DatabaseService,
  appTables: readonly string[]
): Promise<void> =>
  clearStages(
    database,
    appTables.length === 0
      ? ['visitor-data', 'personal-settings', 'engine-caches']
      : ['record-scoped', 'visitor-data', 'personal-settings', 'engine-caches'],
    {
      appTables: sql.join(
        appTables.map((name) => sql`${name}`),
        sql`, `
      ),
    }
  )

const NO_SCOPE: ClearScope = { appTables: sql`` }

/**
 * Strip every account the reset keeps to its password: no API key, no token,
 * no passkey, no second factor, no calendar feed, no OAuth client, no pending
 * verification and no linked sign-in beyond its password and the platform
 * administrator's Cloud link. Its connected third-party accounts are matched
 * against the baselines instead, never stripped first: their live tokens are
 * the ones to keep.
 */
export const clearKeptSignInMaterial = async (database: DatabaseService): Promise<void> => {
  await clearStages(database, ['sign-in-material', 'sign-in-feeds'], NO_SCOPE)
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`UPDATE ${database.dialect.sql.authTableRef('user')} SET two_factor_enabled = ${storedFalse(database.dialect)}`
  )
}

/** Remove every OAuth resource no remaining client links to, but the engine's. Run once the kept clients are back. */
export const clearUnlinkedOAuthResources = (database: DatabaseService): Promise<void> =>
  clearStages(database, ['unlinked-oauth-resources'], NO_SCOPE)

/** How many sessions there are. */
export const countSessions = async (database: DatabaseService): Promise<number> =>
  Number(
    (
      await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT COUNT(*) AS n FROM ${database.dialect.sql.authTableRef('session')}`
      )
    )[0]?.n ?? 0
  )

/** End every session. */
export const deleteAllSessions = async (database: DatabaseService): Promise<void> => {
  await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`DELETE FROM ${database.dialect.sql.authTableRef('session')}`
  )
}

/** The tables a stored key may be named in: every table but the storage catalog itself. */
const surviving = async (database: DatabaseService): Promise<readonly SQL[]> => {
  const rows = isSqlite(database.dialect)
    ? await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT name, NULL AS schema FROM sqlite_master WHERE type = 'table'`
      )
    : await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT table_name AS name, table_schema AS schema FROM information_schema.tables
            WHERE table_schema IN ('public', 'system', 'auth') AND table_type = 'BASE TABLE'`
      )
  return rows
    .filter((row) => !/file_storage_(metadata|bytea)$/.test(String(row.name)))
    .map((row) =>
      row.schema === null || row.schema === undefined
        ? sql`${sql.identifier(String(row.name))}`
        : sql`${sql.identifier(String(row.schema))}.${sql.identifier(String(row.name))}`
    )
}

/** The text of every surviving row, automation runs and avatars included. */
export const referencingText = async (database: DatabaseService): Promise<string> => {
  const tables = await surviving(database)
  const rows = await Promise.all(
    tables.map((table) =>
      executeRawOn(database.dialect.kind, database.client, sql`SELECT * FROM ${table}`)
    )
  )
  return JSON.stringify(rows)
}

/**
 * Remove every stored file the app's storage catalog lists that `text` — the
 * surviving rows — does not name, and answer how many. Each removed file is
 * evicted from the transform cache too: the server keeps the bytes it last
 * served, and a deleted file must not be served again.
 *
 * A file a signing request holds as evidence is never removed: a reset keeps
 * the evidence tables, and the chain names a signer's mark only inside its
 * canonical bytes, which the rows' text spells as numbers, not as the key.
 */
export const removeFilesNotNamedIn = (
  storage: Context.Service.Shape<typeof StorageService>,
  text: string
): Effect.Effect<number, StorageError> =>
  Effect.gen(function* () {
    const keys = yield* storage.list('')
    const catalogued = yield* storage.catalogBuckets(keys)
    const orphans = [...catalogued.entries()].filter(
      ([key]) => !text.includes(key) && !isSignatureEvidenceKey(key)
    )
    yield* Effect.forEach(
      orphans,
      ([key, bucket]) =>
        storage
          .delete(key, bucket ?? UNATTRIBUTED_BUCKET)
          .pipe(Effect.tap(() => Effect.sync(() => evictTransformCacheForKey(key)))),
      { discard: true }
    )
    return orphans.length
  })
