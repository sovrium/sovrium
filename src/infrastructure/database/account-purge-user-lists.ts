/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The erasure's reach into the `user` fields that hold several people.
 *
 * A one-person `user` field is a foreign key with `ON DELETE SET NULL`: the
 * closing delete of the account empties it. A list of people is a list column
 * no key can reach, so the erasure takes her id out of every list naming her
 * itself — a hard edit, inside the erasure's own transaction, that keeps the
 * other people in their order and leaves a list that named only her empty
 * (`[]`, on both engines). A list that never named her is not touched.
 *
 * Membership is read with her id BOUND, never matched as text: `text[]` on
 * PostgreSQL, a JSON array on SQLite.
 */

import { sql, type SQL } from 'drizzle-orm'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { listMemberFragmentOn } from './table-queries/server-operator-fragment'
import type { Dialect, TransactionOn } from './drizzle/layer'

/** "`column` lists `userId`", on `dialect`. */
const listNamesUser = (dialect: Dialect, column: string, userId: string): Readonly<SQL> =>
  listMemberFragmentOn(dialect.kind, sql.identifier(column), userId)

/** `column` less every occurrence of `userId`, keeping the others in their order. */
const listWithout = (dialect: Dialect, column: string, userId: string): Readonly<SQL> => {
  const list = sql.identifier(column)
  return dialect.kind === 'sqlite'
    ? sql`(SELECT json_group_array(value) FROM (SELECT value FROM json_each(${list}) WHERE value <> ${userId} ORDER BY key))`
    : sql`array_remove(${list}, ${userId})`
}

/** The ids of `table`'s rows whose list `columns` name `userId`. */
export const idsListing = async (
  { tx, dialect }: TransactionOn,
  table: string,
  columns: readonly string[],
  userId: string
): Promise<readonly string[]> => {
  if (columns.length === 0) return []
  const rows = await executeRawOn(
    dialect.kind,
    tx,
    sql`SELECT id FROM ${sql.identifier(table)} WHERE ${sql.join(
      columns.map((column) => listNamesUser(dialect, column, userId)),
      sql` OR `
    )}`
  )
  return rows.map((row) => String(row['id']))
}

/** Take `userId` out of every list `columns` of `table` holds. */
export const removeFromUserLists = async (
  { tx, dialect }: TransactionOn,
  table: string,
  columns: readonly string[],
  userId: string
): Promise<void> => {
  await columns.reduce<Promise<void>>(async (previous, column) => {
    await previous
    await executeRawOn(
      dialect.kind,
      tx,
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${listWithout(dialect, column, userId)} WHERE ${listNamesUser(dialect, column, userId)}`
    )
  }, Promise.resolve())
}
