/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { CONSTRAINT_MESSAGES } from '@/domain/errors/driver-failure'
import {
  DatabaseError,
  ForeignKeyViolationError,
  ValidationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { executeRaw } from '../../sql/dialect-execute'
import { authTableRef } from '../../sql/dialect-sql'
import { isSqliteRuntime } from '../../unsupported-in-sqlite'
import type { AccountReference } from '@/application/ports/repositories/tables/record-write-accounts'

/** How many account ids one confirming read names, far below both engines' parameter ceilings. */
const CONFIRM_CHUNK = 500

/** The ids among `ids` that name an account, each held until the transaction ends. */
const confirmedChunk = async (
  tx: Readonly<DrizzleTransaction>,
  ids: readonly string[]
): Promise<ReadonlySet<string>> => {
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )
  // PostgreSQL: the key-share lock a one-person `user` field's foreign key
  // takes on the account it references. An erasure holds the account for its
  // delete before it writes any record, so it waits for this write to commit
  // (and then edits the list it stored), and a write that comes after finds no row. SQLite has one writer, so
  // the read inside the write transaction is already serialised with it.
  const lock = isSqliteRuntime() ? sql`` : sql` FOR KEY SHARE`
  const rows = await executeRaw(
    tx,
    sql`SELECT id FROM ${authTableRef('user')} WHERE id IN (${list}) ORDER BY id${lock}`
  )
  return new Set(rows.map((row) => String(row['id'])))
}

/**
 * Confirm, inside the write's own transaction, that every account a list of
 * people names still exists, and hold those accounts until the write commits.
 * The first field naming a missing account fails the write with the error a
 * missing one-person reference gets; nothing of it is kept.
 */
export async function confirmAccountsInTransaction(
  tx: Readonly<DrizzleTransaction>,
  accounts: readonly AccountReference[] | undefined
): Promise<void> {
  const ids = [...new Set((accounts ?? []).flatMap((reference) => reference.ids))].toSorted()
  if (ids.length === 0) return
  const chunks = Array.from({ length: Math.ceil(ids.length / CONFIRM_CHUNK) }, (_, i) =>
    ids.slice(i * CONFIRM_CHUNK, (i + 1) * CONFIRM_CHUNK)
  )
  const found = await chunks.reduce<Promise<ReadonlySet<string>>>(
    async (previous, chunk) => new Set([...(await previous), ...(await confirmedChunk(tx, chunk))]),
    Promise.resolve(new Set())
  )
  const refused = (accounts ?? []).find((reference) => reference.ids.some((id) => !found.has(id)))
  if (refused === undefined) return
  throw new ForeignKeyViolationError(`referenced ${refused.field} does not exist`, refused.field)
}

/**
 * {@link confirmAccountsInTransaction} for a batch, which answers a missing
 * reference as every batch does: the whole batch refused, nothing written.
 */
export const confirmBatchAccounts = (
  tx: Readonly<DrizzleTransaction>,
  accounts: readonly AccountReference[] | undefined
): Effect.Effect<void, DatabaseError | ValidationError> =>
  Effect.tryPromise({
    try: () => confirmAccountsInTransaction(tx, accounts),
    catch: (error) =>
      error instanceof ForeignKeyViolationError
        ? new ValidationError(CONSTRAINT_MESSAGES['foreign-key'], [])
        : new DatabaseError('Failed to confirm the accounts a batch names', error),
  })
