/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an `app/seed` reset clears besides the app's own tables and accounts:
 * what the engine keeps against a record, what a visitor leaves in the app's
 * system tables, the sign-in material of every account it keeps (before its
 * baseline, if it has one, is put back), and the stored files nothing names
 * any more.
 *
 * Operator records stay: automation runs and their steps, the webhook outbox
 * and its deliveries, analytics, the audit log and the boot ledger describe
 * what the instance did, not data a visitor brought.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { seedTablesOf } from '@/application/use-cases/seed/seed-config'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import {
  PLATFORM_SSO_PROVIDER_ID,
  SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR,
} from '@/domain/models/process-env/platform-sso'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { systemTableExists } from '@/infrastructure/database/sql/dialect-introspection'
import {
  authTableRef,
  authUserTableRef,
  systemTableRef,
} from '@/infrastructure/database/sql/dialect-sql'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import type { App } from '@/domain/models/app'
import type { SQL } from 'drizzle-orm'

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

type Clear = readonly [table: string, where: SQL]

/** Run `DELETE … WHERE` on each table that exists; a table never created holds nothing. */
const clearEach = (
  clears: readonly Clear[],
  ref: (table: string) => SQL,
  exists: (table: string) => Promise<boolean>
): Promise<void> =>
  clears.reduce<Promise<void>>(
    (previous, [table, where]) =>
      previous.then(async () => {
        if (!(await exists(table))) return
        await executeRaw(db, sql`DELETE FROM ${ref(table)} WHERE ${where}`).catch(
          (error: unknown) => {
            throw new Error(`reset could not clear ${table}: ${describe(error)}`)
          }
        )
      }),
    Promise.resolve()
  )

const systemExists = (table: string) => systemTableExists(db, table)

export const isSqlite = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'

/**
 * Whether an auth table exists. Most are created by the migrations; the
 * plugin ones (API keys, passkeys, device codes) only for an app that turns
 * the plugin on.
 */
export const authExists = async (table: string): Promise<boolean> => {
  const rows = isSqlite()
    ? await executeRaw(
        db,
        sql`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${`auth_${table}`}`
      )
    : await executeRaw(
        db,
        sql`SELECT 1 AS present FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = ${table}`
      )
  return rows.length > 0
}

/**
 * What the engine keeps against a user-table record: comments and who read
 * them, the activity history, the search index, AI-computed values and the
 * per-record grants. Every user table is emptied,
 * so none of it points at anything any more.
 */
const recordScopedRows = (tables: readonly string[]): readonly Clear[] => {
  const names = sql.join(
    tables.map((name) => sql`${name}`),
    sql`, `
  )
  return [
    ['record_comments', sql`1 = 1`],
    ['comment_read_state', sql`1 = 1`],
    ['activity_logs', sql`table_name IN (${names})`],
    ['search_index', sql`table_name IN (${names})`],
    ['ai_field_cache', sql`table_name IN (${names})`],
    ['ai_compute_status', sql`table_name IN (${names})`],
    ['user_access', sql`table_slug IN (${names})`],
  ]
}

/** What a visitor leaves in the system tables: form submissions and conversations with an assistant. */
const VISITOR_DATA: readonly Clear[] = [
  ['form_submissions', sql`1 = 1`],
  ['ai_tool_calls', sql`1 = 1`],
  ['ai_messages', sql`1 = 1`],
  ['ai_chat_attachments', sql`1 = 1`],
  ['ai_conversations', sql`1 = 1`],
]

/**
 * The small settings an account gathers, which a reset returns to their
 * defaults, baseline or not: notification channels and the inbox (which names
 * records the reset emptied), favourites and recently viewed items of every
 * kind, which records were read, and presence.
 */
const PERSONAL_SETTINGS: readonly Clear[] = [
  ['notification_preferences', sql`1 = 1`],
  ['notifications', sql`1 = 1`],
  ['user_favorites', sql`1 = 1`],
  ['user_recent_items', sql`1 = 1`],
  ['read_state', sql`1 = 1`],
  ['user_presence', sql`1 = 1`],
]

/**
 * A token the app obtained with a connection's own client credentials: a cache
 * the engine obtains again on its next call, never a credential anyone gave.
 */
const ENGINE_CACHES: readonly Clear[] = [
  ['connection_app_tokens', sql`grant_fingerprint IS NOT NULL`],
]

/**
 * Remove every system row kept against a record of the app's tables, every
 * visitor's data, every account's small settings and the engine's caches.
 */
export const clearRecordScopedRows = async (app: Readonly<App>): Promise<void> => {
  const tables = seedTablesOf(app).map((table) => table.name)
  const scoped = tables.length === 0 ? [] : recordScopedRows(tables)
  await clearEach(
    [...scoped, ...VISITOR_DATA, ...PERSONAL_SETTINGS, ...ENGINE_CACHES],
    systemTableRef,
    systemExists
  )
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

/** The Sovrium Cloud subject the host binds its owner to, if it names one. */
export const platformAdminSubject = (): string | undefined => {
  const subject = Bun.env[SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR]?.trim() ?? ''
  return subject === '' ? undefined : subject
}

/**
 * The confidential client the engine registers for its own MCP resource server
 * at boot (`mcpResourceServerCredentials` in the auth infrastructure, which the
 * CLI may not import). Host configuration with no owner: a reset keeps it, or
 * the MCP endpoint would refuse every bearer until the next restart.
 */
const ENGINE_OAUTH_CLIENT_ID = 'sovrium-mcp-resource-server'

/**
 * The sign-in rows a kept account carries apart from its password and, for
 * the platform administrator, its Sovrium Cloud link — and the OAuth clients
 * with no account behind them and the spent client assertions, which no reset
 * can attribute to anyone.
 */
const signInMaterial = (): readonly Clear[] => {
  const cloudLink = platformAdminCloudLink()
  return [
    ['api_key', sql`1 = 1`],
    ['oauth_access_token', sql`1 = 1`],
    ['oauth_refresh_token', sql`1 = 1`],
    ['oauth_consent', sql`1 = 1`],
    ['oauth_client_assertion', sql`1 = 1`],
    ['oauth_client', sql`client_id <> ${ENGINE_OAUTH_CLIENT_ID}`],
    [
      'oauth_client_resource',
      sql`client_id NOT IN (SELECT client_id FROM ${authTableRef('oauth_client')})`,
    ],
    ['passkey', sql`1 = 1`],
    ['two_factor', sql`1 = 1`],
    ['device_code', sql`1 = 1`],
    ['verification', sql`1 = 1`],
    ['account', sql`provider_id <> 'credential' AND NOT (${cloudLink})`],
  ]
}

/**
 * Strip every account the reset keeps to its password: no API key, no token,
 * no passkey, no second factor, no calendar feed, no OAuth client, no pending
 * verification and no linked sign-in beyond its password and the platform
 * administrator's Cloud link. What an account with no baseline yet is left
 * with; an account with one is then returned to it (`seed-self-baseline.ts`).
 * Its connected third-party accounts are matched against the baselines
 * instead, never stripped first: their live tokens are the ones to keep. Run
 * before the seed, which writes its own invitations.
 */
export const clearKeptSignInMaterial = async (): Promise<void> => {
  await clearEach(signInMaterial(), authTableRef, authExists)
  await clearEach([['calendar_feed_tokens', sql`1 = 1`]], systemTableRef, systemExists)
  const off = isSqlite() ? 0 : false
  await executeRaw(db, sql`UPDATE ${authUserTableRef()} SET two_factor_enabled = ${off}`)
}

/**
 * The resource the engine declares for its MCP endpoint and seeds once per
 * process: the server's origin and `/mcp`, derived as `mcpResourceIdentifier`
 * in the auth infrastructure derives it (which the CLI may not import). Removed,
 * every MCP token would name an audience the server no longer knows until the
 * next restart.
 */
const engineOAuthResource = (): string =>
  `${(Bun.env.BASE_URL || `http://localhost:${Bun.env.PORT || 3000}`).replace(/\/+$/, '')}/mcp`

/**
 * Remove every OAuth resource no remaining client links to, but the one the
 * engine declares. Run once the kept clients are back.
 */
export const clearUnlinkedOAuthResources = (): Promise<void> =>
  clearEach(
    [
      [
        'oauth_resource',
        sql`identifier <> ${engineOAuthResource()}
            AND identifier NOT IN (SELECT resource_id FROM ${authTableRef('oauth_client_resource')})`,
      ],
    ],
    authTableRef,
    authExists
  )

/** The tables a stored key may be named in: every table but the storage catalog itself. */
const surviving = async (): Promise<readonly SQL[]> => {
  const rows = isSqlite()
    ? await executeRaw(db, sql`SELECT name, NULL AS schema FROM sqlite_master WHERE type = 'table'`)
    : await executeRaw(
        db,
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
const referencingText = async (): Promise<string> => {
  const tables = await surviving()
  const rows = await Promise.all(tables.map((table) => executeRaw(db, sql`SELECT * FROM ${table}`)))
  return JSON.stringify(rows)
}

/**
 * Remove every stored file the app's storage catalog lists that no surviving
 * row names — an app row, an avatar, a kept system row, an automation run's
 * input or output — and answer how many. Called once the seed is written, so
 * the files the seed itself stored stay.
 */
export const removeUnreferencedFiles = async (): Promise<number> => {
  const text = await referencingText()
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    const keys = yield* storage.list('')
    const catalogued = yield* storage.catalogBuckets(keys)
    const orphans = [...catalogued.entries()].filter(([key]) => !text.includes(key))
    yield* Effect.forEach(
      orphans,
      ([key, bucket]) =>
        storage
          .delete(key, bucket ?? UNATTRIBUTED_BUCKET)
          // The server keeps the bytes it last served; a deleted file must not be served again.
          .pipe(Effect.tap(() => Effect.sync(() => evictTransformCacheForKey(key)))),
      { discard: true }
    )
    return orphans.length
  })
  return Effect.runPromise(Effect.provide(program, StorageServiceLive)).catch((error: unknown) => {
    throw new Error(`reset could not remove the unreferenced files: ${describe(error)}`)
  })
}
