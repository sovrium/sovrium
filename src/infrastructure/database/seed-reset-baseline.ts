/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The baseline a reset of the app to its seed returns each account it keeps to.
 *
 * A baseline is a COPY, not a watermark: the account's whole user row (name,
 * email, email verification, avatar, whether two-step verification is on,
 * whether it is banned or scheduled for erasure, its language), every
 * standing sign-in row it holds — its second factor, passkeys, API keys,
 * calendar-feed tokens and linked sign-in accounts, its password credential
 * included — the OAuth clients it registered with their resource links, and
 * the third-party accounts it connected. Every copy also holds the app's own
 * connections, which belong to the installation rather than to a person.
 * Restoring it (`seed-reset-baseline-restore.ts`) removes what was added since
 * and puts back what was changed or deleted, which no timestamp could express.
 * A connection is matched by identity rather than replaced: the provider
 * rotates its tokens on every refresh, so the live row is the one to keep.
 *
 * Rows are copied as the database stores them, under their column names. On
 * PostgreSQL each is read with `row_to_json` and written back through
 * `json_populate_record(set)`, so every column type round-trips through the
 * database's own conversion; SQLite's values are plain numbers, strings and
 * nulls already. Only the columns the table still has are written back, so a
 * column added since the copy takes its default and one dropped is skipped.
 *
 * The store, `system.account_baselines`, holds key hashes, second-factor
 * secrets, client secrets and sealed tokens: only a reset and
 * `sovrium seed --baseline` touch it, and no error raised while reading or
 * writing a copy carries the copy's values — a reset's error reaches the
 * automation's run history, which an administrator reads. Erasing an account
 * erases its baseline (the row cascades, and erasure names it).
 */

import { sql } from 'drizzle-orm'
import { PLATFORM_SSO_PROVIDER_ID } from '@/domain/models/process-env/platform-sso'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import { platformAdminSubject } from './seed-reset-clear'
import { inTurn, isSqlite, runQuietly, storedFalse, storedNow } from './seed-reset-statements'
import type {
  BaselineSnapshot,
  RecordedBaseline,
  StoredRow,
} from '@/application/ports/repositories/seed/seed-reset-repository'
import type { DatabaseService, Dialect } from '@/infrastructure/database/drizzle/layer'
import type { SQL } from 'drizzle-orm'
import type { Effect } from 'effect'

/** A table a baseline copies: where it lives, which column names the account, and how it is restored. */
export interface CopiedTable {
  /** The key the snapshot stores its rows under: the table's bare name. */
  readonly key: string
  readonly schema: 'auth' | 'system'
  /** The column naming the account. None for an app-wide store, whose rows every copy holds. */
  readonly owner?: string
  /** The owner column holds a key of another copied table's rows (`column`), not the account id. */
  readonly through?: { readonly table: CopiedTable; readonly column: string }
  /**
   * The columns identifying a row. A row the copy holds by them is left as it
   * stands, one it does not hold is removed, one missing comes back from the
   * copy. Without them every row of the account is replaced by the copy.
   */
  readonly identity?: readonly string[]
  /** A row another table must hold for a copied row to be written back. */
  readonly needs?: {
    readonly column: string
    readonly table: CopiedTable
    readonly target: string
  }
  /** A column that, set, marks a cache the engine obtains again: never copied, never kept. */
  readonly transient?: string
}

/** The account's own row. */
export const USER_TABLE: CopiedTable = { key: 'user', schema: 'auth', owner: 'id' }

const OAUTH_CLIENT: CopiedTable = { key: 'oauth_client', schema: 'auth', owner: 'user_id' }
const OAUTH_RESOURCE: CopiedTable = { key: 'oauth_resource', schema: 'auth' }
const CONNECTIONS: CopiedTable = { key: 'connections', schema: 'system' }

/**
 * What a baseline holds besides the user row, in the order rows are written
 * back (and removed in reverse). Short-lived and client-issued material is not here.
 */
export const COPIED_TABLES: readonly CopiedTable[] = [
  { key: 'account', schema: 'auth', owner: 'user_id' },
  { key: 'two_factor', schema: 'auth', owner: 'user_id' },
  { key: 'passkey', schema: 'auth', owner: 'user_id' },
  { key: 'api_key', schema: 'auth', owner: 'reference_id' },
  { key: 'calendar_feed_tokens', schema: 'system', owner: 'user_id' },
  OAUTH_CLIENT,
  {
    key: 'oauth_client_resource',
    schema: 'auth',
    owner: 'client_id',
    through: { table: OAUTH_CLIENT, column: 'client_id' },
    needs: { column: 'resource_id', table: OAUTH_RESOURCE, target: 'identifier' },
  },
  {
    key: 'connection_tokens',
    schema: 'system',
    owner: 'user_id',
    identity: ['connection_id', 'user_id'],
    needs: { column: 'connection_id', table: CONNECTIONS, target: 'id' },
  },
  {
    key: 'connection_app_tokens',
    schema: 'system',
    identity: ['connection_id'],
    needs: { column: 'connection_id', table: CONNECTIONS, target: 'id' },
    transient: 'grant_fingerprint',
  },
]

const STORE: CopiedTable = { key: 'account_baselines', schema: 'system', owner: 'user_id' }

/** The table's reference in `dialect`. */
export const refOf = (dialect: Dialect, table: CopiedTable): SQL =>
  table.schema === 'auth'
    ? dialect.sql.authTableRef(table.key)
    : dialect.sql.systemTableRef(table.key)

/** The columns `table` has now, none when it does not exist (a plugin the app does not turn on). */
export const liveColumns = async (
  database: DatabaseService,
  table: CopiedTable
): Promise<readonly string[]> => {
  const rows = isSqlite(database.dialect)
    ? await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT name FROM pragma_table_xinfo(${`${table.schema}_${table.key}`}) WHERE hidden = 0`
      )
    : await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT column_name AS name FROM information_schema.columns
            WHERE table_schema = ${table.schema} AND table_name = ${table.key}
              AND is_generated = 'NEVER'`
      )
  return rows.map((row) => String(row.name))
}

/**
 * The rows of `table` the accounts `ids` own: by its owner column, or through
 * the table its owner column points into. An app-wide table is owned by no one.
 */
export const ownedBy = (dialect: Dialect, table: CopiedTable, ids: SQL): SQL => {
  if (table.owner === undefined) return sql`1 = 0`
  const column = sql.identifier(table.owner)
  if (table.through === undefined) return sql`${column} IN (${ids})`
  const via = table.through.table
  return sql`${column} IN (SELECT ${sql.identifier(table.through.column)} FROM ${refOf(dialect, via)}
    WHERE ${sql.identifier(via.owner ?? 'id')} IN (${ids}))`
}

/** The rows of `table` a copy for `userId` holds: the account's own, or every one of an app-wide table. */
const copiedBy = (dialect: Dialect, table: CopiedTable, userId: string): SQL => {
  const owned = table.owner === undefined ? sql`1 = 1` : ownedBy(dialect, table, sql`${userId}`)
  return table.transient === undefined
    ? owned
    : sql`${owned} AND ${sql.identifier(table.transient)} IS NULL`
}

/** Every row of `table` a copy for `userId` holds, as the database stores it. */
const copyRows = async (
  database: DatabaseService,
  table: CopiedTable,
  userId: string
): Promise<readonly StoredRow[]> => {
  if (isSqlite(database.dialect)) {
    return executeRawOn(
      database.dialect.kind,
      database.client,
      sql`SELECT * FROM ${refOf(database.dialect, table)} WHERE ${copiedBy(database.dialect, table, userId)}`
    )
  }
  const rows = await executeRawOn(
    database.dialect.kind,
    database.client,
    sql`SELECT row_to_json(t)::text AS row FROM ${refOf(database.dialect, table)} t WHERE ${copiedBy(database.dialect, table, userId)}`
  )
  return rows.map((row) => JSON.parse(String(row.row)) as StoredRow)
}

/** The account's user row and standing sign-in rows, as they are now; none when it does not exist. */
const captureSnapshot = async (
  database: DatabaseService,
  userId: string
): Promise<BaselineSnapshot | undefined> => {
  const [user] = await copyRows(database, USER_TABLE, userId)
  if (user === undefined) return undefined
  const copied = await Promise.all(
    COPIED_TABLES.map(async (table) => {
      const present = (await liveColumns(database, table)).length > 0
      return [table.key, present ? await copyRows(database, table, userId) : []] as const
    })
  )
  const profile = Object.fromEntries(Object.entries(user).filter(([column]) => column !== 'id'))
  return { profile, rows: Object.fromEntries(copied) }
}

/** The address a copy records, lower-cased. */
const emailOf = (snapshot: BaselineSnapshot): string => String(snapshot.profile.email).toLowerCase()

/** The account's live state, as `sovrium seed --baseline` records it. */
export const captureBaseline = async (
  database: DatabaseService,
  userId: string
): Promise<RecordedBaseline | undefined> => {
  const snapshot = await captureSnapshot(database, userId)
  return snapshot === undefined ? undefined : { userId, email: emailOf(snapshot), snapshot }
}

/** The user-row columns a first baseline sets, whatever the account held. */
const firstProfile = (database: DatabaseService, keptFor: string | undefined): StoredRow => {
  const off = storedFalse(database.dialect)
  return {
    two_factor_enabled: off,
    banned: off,
    ban_reason: null,
    ban_expires: null,
    scheduledErasureAt: null,
    ...(keptFor === undefined ? {} : { email: keptFor }),
  }
}

/**
 * The first baseline of an account a reset kept with none: its copy cut down
 * to what such an account is left with — its password credential and the
 * platform administrator's Cloud link, no second factor, passkey, API key or
 * calendar feed, not banned and not scheduled for erasure — under the address
 * it was kept for. Cut rather than trusted, because the copy is read once the
 * seed is written, and what a visitor signed in with the public password adds
 * meanwhile must not be recorded as the account's to keep.
 */
const firstBaseline = (
  database: DatabaseService,
  userId: string,
  snapshot: BaselineSnapshot,
  keptFor: string | undefined
): RecordedBaseline => {
  const subject = platformAdminSubject()
  const set = firstProfile(database, keptFor)
  const profile = Object.fromEntries(
    Object.entries(snapshot.profile).map(([column, value]) => [
      column,
      column in set ? set[column] : value,
    ])
  )
  const isKeptLink = (row: StoredRow) =>
    row.provider_id === 'credential' ||
    (subject !== undefined &&
      row.provider_id === PLATFORM_SSO_PROVIDER_ID &&
      row.account_id === subject)
  const rows = Object.fromEntries(
    COPIED_TABLES.map((table) => [
      table.key,
      table.key === 'account' ? (snapshot.rows.account ?? []).filter(isKeptLink) : [],
    ])
  )
  const cut = { profile, rows }
  return { userId, email: emailOf(cut), snapshot: cut }
}

/** The first baseline of an account kept with none, read now; none when it does not exist. */
export const captureFirstBaseline = async (
  database: DatabaseService,
  userId: string,
  keptFor: string | undefined
): Promise<RecordedBaseline | undefined> => {
  const snapshot = await captureSnapshot(database, userId)
  return snapshot === undefined ? undefined : firstBaseline(database, userId, snapshot, keptFor)
}

/** Every recorded baseline, keyed by account id. */
export const readBaselines = async (
  database: DatabaseService
): Promise<ReadonlyMap<string, RecordedBaseline>> => {
  if ((await liveColumns(database, STORE)).length === 0) return new Map()
  const rows = await runQuietly(
    { tx: database.client, dialect: database.dialect },
    sql`SELECT user_id, email, snapshot FROM ${refOf(database.dialect, STORE)}`,
    'reset could not read the recorded baselines'
  )
  return new Map(
    rows.map((row) => {
      const userId = String(row.user_id)
      const snapshot = JSON.parse(String(row.snapshot)) as BaselineSnapshot
      return [userId, { userId, email: String(row.email).toLowerCase(), snapshot }] as const
    })
  )
}

const RECORD_WHAT = 'could not record the baselines of the accounts a reset keeps'

/**
 * Record `baselines`, replacing every baseline recorded before, in one
 * transaction: one the kept set no longer names — an administrator whose
 * address the host changed on purpose — is dropped, and an account erased
 * meanwhile is skipped. Answers what was recorded.
 */
export const recordBaselines = <E>(
  database: DatabaseService,
  baselines: readonly RecordedBaseline[],
  onFailure: (error: unknown) => E
): Effect.Effect<readonly RecordedBaseline[], E> => {
  const { dialect } = database
  const recordedAt = storedNow(dialect)
  return withPromiseTransaction(
    database.client,
    async (tx) => {
      await runQuietly({ tx, dialect }, sql`DELETE FROM ${refOf(dialect, STORE)}`, RECORD_WHAT)
      const written = new Set<string>()
      await inTurn(baselines, async (baseline) => {
        const rows = await runQuietly(
          { tx, dialect },
          sql`INSERT INTO ${refOf(dialect, STORE)} (user_id, email, snapshot, recorded_at)
              SELECT ${baseline.userId}, ${baseline.email}, ${JSON.stringify(baseline.snapshot)},
                     ${recordedAt}
              WHERE EXISTS (SELECT 1 FROM ${refOf(dialect, USER_TABLE)} WHERE id = ${baseline.userId})
              RETURNING user_id`,
          RECORD_WHAT
        )
        if (rows.length > 0) written.add(baseline.userId)
      })
      return baselines.filter((baseline) => written.has(baseline.userId))
    },
    onFailure
  )
}
