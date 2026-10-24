/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Returning kept accounts to their baselines (`seed-self-baseline.ts`), all of
 * them in one transaction: a statement that fails leaves every account as it
 * was before the restore, never half put back.
 *
 * In order: an address a baseline puts back that another account holds now is
 * parked on a throwaway address first, so two kept accounts whose addresses a
 * visitor swapped do not refuse each other's; then every copied table loses
 * every restored account's rows (the platform administrator's Cloud link, host
 * configuration, excepted), links before what they link, before any copy is
 * written back, so a row one account's copy holds is never refused for a key
 * another account's row still held; then each account's user row is put back.
 *
 * A table matched by identity — the third-party connections — is not replaced:
 * every live row no copy holds by its identity goes, whoever's it is (every
 * account left by a reset is a kept one, and one with no baseline holds none),
 * the rows the copies hold keep their live values, and only a missing one is
 * written back from its copy. A copied row whose parent is gone since — a
 * connection deleted, a resource unregistered — is not written back.
 */

import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  COPIED_TABLES,
  USER_TABLE,
  liveColumns,
  ownedBy,
  refOf,
  runQuietly,
} from './seed-self-baseline'
import { isSqlite } from './seed-self-clear'
import type { CopiedTable, RecordedBaseline, StoredRow } from './seed-self-baseline'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import type { SQL } from 'drizzle-orm'

const WHAT = 'reset could not return a kept account to its baseline'

type Runner = Readonly<RawSqlRunner>

/** Run `step` on each item, one after the other. */
const inTurn = <T>(items: readonly T[], step: (item: T) => Promise<unknown>): Promise<void> =>
  items.reduce<Promise<void>>(
    (previous, item) =>
      previous.then(async () => {
        await step(item)
      }),
    Promise.resolve()
  )

/** The columns of `rows` the table still has: a column added since takes its default. */
const writable = (rows: readonly StoredRow[], columns: readonly string[]): readonly string[] => {
  const held = new Set(rows.flatMap((row) => Object.keys(row)))
  return columns.filter((column) => held.has(column))
}

const identifiers = (columns: readonly string[]): SQL =>
  sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `
  )

/** A value SQLite binds as it stored it. */
const bound = (value: unknown): SQL => sql`${value as string | number | null}`

/** The row `table` must find in its parent for `value`, or nothing to require. */
const parentOf = (table: CopiedTable, value: (column: string) => SQL): SQL => {
  const { needs } = table
  if (needs === undefined) return sql`1 = 1`
  return sql`EXISTS (SELECT 1 FROM ${refOf(needs.table)}
    WHERE ${sql.identifier(needs.target)} = ${value(needs.column)})`
}

/** Write rows back as they were copied; a row whose key is already there is left as it stands. */
const writeRows = async (
  tx: Runner,
  table: CopiedTable,
  rows: readonly StoredRow[],
  live: readonly string[]
): Promise<void> => {
  const columns = writable(rows, live)
  if (rows.length === 0 || columns.length === 0) return
  if (!isSqlite()) {
    // `::text` first: a parameter PostgreSQL types as `json` is JSON-encoded by
    // the driver, which would hand `json_populate_recordset` a string scalar.
    await runQuietly(
      tx,
      sql`INSERT INTO ${refOf(table)} (${identifiers(columns)})
          SELECT ${identifiers(columns)}
          FROM json_populate_recordset(NULL::${refOf(table)}, ${JSON.stringify(rows)}::text::json) AS r
          WHERE ${parentOf(table, (column) => sql`r.${sql.identifier(column)}`)}
          ON CONFLICT DO NOTHING`,
      WHAT
    )
    return
  }
  await inTurn(rows, (row) =>
    runQuietly(
      tx,
      sql`INSERT OR IGNORE INTO ${refOf(table)} (${identifiers(columns)})
          SELECT ${sql.join(
            columns.map((column) => bound(row[column] ?? null)),
            sql`, `
          )}
          WHERE ${parentOf(table, (column) => bound(row[column] ?? null))}`,
      WHAT
    )
  )
}

/** The rows every copy holds of `table`, one per identity when it is matched by one. */
const copiesOf = (
  baselines: readonly RecordedBaseline[],
  table: CopiedTable
): readonly StoredRow[] => {
  const rows = baselines.flatMap((baseline) => baseline.snapshot.rows[table.key] ?? [])
  const { identity } = table
  if (identity === undefined) return rows
  const keyOf = (row: StoredRow) => JSON.stringify(identity.map((column) => row[column] ?? null))
  return [...new Map(rows.map((row) => [keyOf(row), row] as const)).values()]
}

/**
 * Remove every row of a table matched by identity that no copy holds by it,
 * and every transient one; the rows the copies hold stay as they stand.
 */
const dropUnmatched = (tx: Runner, table: CopiedTable, rows: readonly StoredRow[]) => {
  const identity = table.identity ?? []
  const held =
    rows.length === 0 || identity.length === 0
      ? sql`1 = 0`
      : sql`(${identifiers(identity)}) IN (VALUES ${sql.join(
          rows.map(
            (row) =>
              sql`(${sql.join(
                identity.map((column) => bound(row[column] ?? null)),
                sql`, `
              )})`
          ),
          sql`, `
        )})`
  const transient =
    table.transient === undefined ? sql`1 = 0` : sql`${sql.identifier(table.transient)} IS NOT NULL`
  return runQuietly(tx, sql`DELETE FROM ${refOf(table)} WHERE ${transient} OR NOT (${held})`, WHAT)
}

/** Put the account's user row back as its copy holds it; the id stays. */
const writeProfile = async (
  tx: Runner,
  baseline: RecordedBaseline,
  live: readonly string[]
): Promise<void> => {
  const { profile } = baseline.snapshot
  const columns = writable([profile], live).filter((column) => column !== 'id')
  if (columns.length === 0) return
  const user = refOf(USER_TABLE)
  const assignments = isSqlite()
    ? columns.map((column) => sql`${sql.identifier(column)} = ${bound(profile[column] ?? null)}`)
    : columns.map((column) => sql`${sql.identifier(column)} = r.${sql.identifier(column)}`)
  const set = sql.join(assignments, sql`, `)
  await runQuietly(
    tx,
    isSqlite()
      ? sql`UPDATE ${user} SET ${set} WHERE id = ${baseline.userId}`
      : sql`UPDATE ${user} AS u SET ${set}
            FROM json_populate_record(NULL::${user}, ${JSON.stringify(profile)}::text::json) AS r
            WHERE u.id = ${baseline.userId}`,
    WHAT
  )
}

/** Move any other account off an address a baseline puts back, onto a throwaway one. */
const parkTakenAddresses = (tx: Runner, baselines: readonly RecordedBaseline[]): Promise<void> =>
  inTurn(baselines, (baseline) =>
    runQuietly(
      tx,
      sql`UPDATE ${refOf(USER_TABLE)} SET email = ${`parked-${randomUUID()}@reset.invalid`}
          WHERE lower(email) = ${baseline.email} AND id <> ${baseline.userId}`,
      WHAT
    )
  )

/**
 * Return each account to its baseline: replace its rows in every copied table
 * and its user row with the copy. `kept` names the `account` rows a restore
 * never removes — the platform administrator's Cloud link. Passwords the seed
 * file or the host name are applied afterwards, by the caller, and win.
 */
export const restoreBaselines = async (
  baselines: readonly RecordedBaseline[],
  kept: SQL
): Promise<void> => {
  const tables = await Promise.all(
    COPIED_TABLES.map(async (table) => ({ table, live: await liveColumns(table) }))
  )
  const present = tables.filter(({ live }) => live.length > 0)
  const replaced = present.filter(({ table }) => table.identity === undefined)
  const matched = present.filter(({ table }) => table.identity !== undefined)
  const userColumns = await liveColumns(USER_TABLE)
  const ids = sql.join(
    baselines.map((baseline) => sql`${baseline.userId}`),
    sql`, `
  )
  await db.transaction(async (tx) => {
    await parkTakenAddresses(tx, baselines)
    if (baselines.length > 0) {
      await inTurn(replaced.toReversed(), ({ table }) =>
        runQuietly(
          tx,
          sql`DELETE FROM ${refOf(table)} WHERE ${ownedBy(table, ids)}
              ${table.key === 'account' ? sql`AND NOT (${kept})` : sql``}`,
          WHAT
        )
      )
    }
    await inTurn(matched, ({ table }) => dropUnmatched(tx, table, copiesOf(baselines, table)))
    await inTurn(present, ({ table, live }) =>
      writeRows(tx, table, copiesOf(baselines, table), live)
    )
    await inTurn(baselines, (baseline) => writeProfile(tx, baseline, userColumns))
  })
}
