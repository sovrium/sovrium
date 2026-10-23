/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an `app/seed` reset clears besides the app's own tables and accounts:
 * what the engine keeps against a record, what a visitor leaves in the app's
 * system tables, the sign-in material of every account it keeps, and the
 * stored files nothing names any more.
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

const isSqlite = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'

/**
 * Whether an auth table exists. Most are created by the migrations; the
 * plugin ones (API keys, passkeys, device codes) only for an app that turns
 * the plugin on.
 */
const authExists = async (table: string): Promise<boolean> => {
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
 * them, favourites and recent items, the activity history, the search index,
 * AI-computed values and the per-record grants. Every user table is emptied,
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
    ['user_favorites', sql`entity_type = 'record'`],
    ['user_recent_items', sql`entity_type = 'record'`],
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

/** Remove every system row kept against a record of the app's tables, and every visitor's data. */
export const clearRecordScopedRows = async (app: Readonly<App>): Promise<void> => {
  const tables = seedTablesOf(app).map((table) => table.name)
  const scoped = tables.length === 0 ? [] : recordScopedRows(tables)
  await clearEach([...scoped, ...VISITOR_DATA], systemTableRef, systemExists)
}

/**
 * The sign-in rows a kept account carries apart from its password and, for
 * the platform administrator, its Sovrium Cloud link.
 */
const signInMaterial = (): readonly Clear[] => {
  const subject = Bun.env[SOVRIUM_PLATFORM_SSO_ADMIN_SUBJECT_VAR]?.trim() ?? ''
  const cloudLink =
    subject === ''
      ? sql`1 = 0`
      : sql`provider_id = ${PLATFORM_SSO_PROVIDER_ID} AND account_id = ${subject}`
  return [
    ['api_key', sql`1 = 1`],
    ['oauth_access_token', sql`1 = 1`],
    ['oauth_refresh_token', sql`1 = 1`],
    ['oauth_consent', sql`1 = 1`],
    ['passkey', sql`1 = 1`],
    ['two_factor', sql`1 = 1`],
    ['device_code', sql`1 = 1`],
    ['verification', sql`1 = 1`],
    ['account', sql`provider_id <> 'credential' AND NOT (${cloudLink})`],
  ]
}

/**
 * Return every account the reset keeps to its seed state: no API key, no
 * token, no passkey, no second factor, no calendar feed, no pending
 * verification and no linked sign-in beyond its password and the platform
 * administrator's Cloud link. Run before the seed, which writes its own
 * invitations.
 */
export const clearKeptSignInMaterial = async (): Promise<void> => {
  await clearEach(signInMaterial(), authTableRef, authExists)
  await clearEach([['calendar_feed_tokens', sql`1 = 1`]], systemTableRef, systemExists)
  const off = isSqlite() ? 0 : false
  await executeRaw(db, sql`UPDATE ${authUserTableRef()} SET two_factor_enabled = ${off}`)
}

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
