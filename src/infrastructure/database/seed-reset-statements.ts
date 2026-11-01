/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The statement primitives a reset of the app to its seed is written with
 * (`SeedResetRepository`): which dialect runs, whether an optional table
 * exists, one statement run without its values reaching an error, and steps
 * run one after the other.
 */

import { sql } from 'drizzle-orm'
import { executeRawOn, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { systemTableExists } from '@/infrastructure/database/sql/dialect-introspection'
import type { DatabaseService, Dialect } from '@/infrastructure/database/drizzle/layer'
import type { SQL } from 'drizzle-orm'

/** A handle a reset statement runs on: the database's client or a transaction. */
export type ResetRunner = Readonly<RawSqlRunner>

/** A runner, with the dialect it speaks. */
export interface ResetOn {
  readonly tx: ResetRunner
  readonly dialect: Dialect
}

/** The message of a failure, as the reset's error carries it. */
export const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Whether the database runs on SQLite. */
export const isSqlite = (dialect: Dialect): boolean => dialect.kind === 'sqlite'

/** A boolean column's `false`, as the dialect stores it. */
export const storedFalse = (dialect: Dialect): number | boolean => (isSqlite(dialect) ? 0 : false)

/** The current instant, as the dialect stores a timestamp column. */
export const storedNow = (dialect: Dialect): SQL =>
  isSqlite(dialect) ? sql`${Date.now()}` : sql`now()`

/** Whether a system table exists. */
export const systemExists = (database: DatabaseService, table: string): Promise<boolean> =>
  systemTableExists(database.dialect.kind, database.client, table)

/**
 * Whether an auth table exists. Most are created by the migrations; the
 * plugin ones (API keys, passkeys, device codes) only for an app that turns
 * the plugin on.
 */
export const authExists = async (database: DatabaseService, table: string): Promise<boolean> => {
  const rows = isSqlite(database.dialect)
    ? await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${`auth_${table}`}`
      )
    : await executeRawOn(
        database.dialect.kind,
        database.client,
        sql`SELECT 1 AS present FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = ${table}`
      )
  return rows.length > 0
}

const FAILED_QUERY = 'the database refused the statement'

/**
 * Why a statement failed, without the values it carried. Drizzle's own message
 * is `Failed query: … params: …`, the params being a copy's key hashes and
 * second-factor secrets; the driver's message names the constraint or column
 * instead, and a value it quotes at the end (`invalid input …: "…"`) is cut.
 */
const reasonOf = (error: unknown): string => {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error
  if (!(cause instanceof Error) || cause.message.startsWith('Failed query')) return FAILED_QUERY
  const [first = FAILED_QUERY] = cause.message.split('\n')
  return first.replace(/: ".*"$/, ': "…"')
}

/** Run one statement; on failure, throw `what` and the reason — never the values. */
export const runQuietly = (
  { tx: runner, dialect }: ResetOn,
  query: SQL,
  what: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(dialect.kind, runner, query).catch((error: unknown) => {
    throw new Error(`${what}: ${reasonOf(error)}`)
  })

/** Run `step` on each item, one after the other. */
export const inTurn = <T>(
  items: readonly T[],
  step: (item: T) => Promise<unknown>
): Promise<void> =>
  items.reduce<Promise<void>>(
    (previous, item) =>
      previous.then(async () => {
        await step(item)
      }),
    Promise.resolve()
  )

/** A comma-separated list of bound values. */
export const boundList = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )
