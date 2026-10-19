/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { collectCauseChain, readSqlState } from '@/domain/errors/driver-failure'
import { db, type DrizzleTransaction } from '@/infrastructure/database/drizzle/db'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/**
 * The transaction every scheduled sweep deletes in, and the words a sweep's
 * failure is logged with.
 *
 * ## Why a sweep opens its transaction READ WRITE
 *
 * A managed PostgreSQL that runs out of disk is not stopped. The managed
 * offers keep it reachable and set `default_transaction_read_only = on`, so
 * every new transaction is read-only
 * unless it says otherwise; the documented way out is to free space from a
 * transaction that opens `READ WRITE` and deletes. A sweep that does not open
 * its transaction that way is refused in that state (`cannot execute DELETE in
 * a read-only transaction`, SQLSTATE 25006), is logged and swallowed, and the
 * volume keeps filling until the server crashes on a hard ENOSPC: the one
 * mechanism built to free space cannot run in the one state where it matters.
 *
 * Every scheduled delete therefore runs through {@link inReadWriteTransaction}:
 * one transaction, explicitly `READ WRITE`, which is the one write such a
 * server allows. SQLite has no such mode, so there the plain transaction is
 * the same thing. A sweep that is STILL refused — a hot standby refuses
 * `READ WRITE` outright — is logged with the table, the rows it meant to delete
 * and the refusal ({@link describeSweepFailure}), and its scheduler re-arms as
 * before.
 */

/** PostgreSQL's SQLSTATE for a write refused inside a read-only transaction. */
export const READ_ONLY_TRANSACTION_SQLSTATE = '25006'

/**
 * Whether `error`, or anything in its `cause` chain, is a write the database
 * refused because the transaction was read-only.
 *
 * Matched on the SQLSTATE first (`errno` on `bun:sql`, `code` on `pg`) and on
 * the server's own wording as a fallback, so a driver that drops the code is
 * still recognised.
 */
export const isReadOnlyRefusal = (error: unknown): boolean =>
  collectCauseChain(error).some(
    (node) =>
      readSqlState(node) === READ_ONLY_TRANSACTION_SQLSTATE ||
      (typeof node.message === 'string' && /read-only transaction/i.test(node.message))
  )

/**
 * A sweep whose delete the database refused: which table, how many rows were
 * due, and the driver's error as `cause`.
 */
export class RetentionSweepFailure extends Error {
  readonly table: string
  readonly attempted: number

  constructor(args: {
    readonly table: string
    readonly attempted: number
    readonly cause: unknown
  }) {
    super(`${args.table}: the delete of ${String(args.attempted)} due row(s) was refused`, {
      cause: args.cause,
    })
    this.name = 'RetentionSweepFailure'
    this.table = args.table
    this.attempted = args.attempted
  }
}

/** The sweep failure an executor raised, wherever it sits in `cause`'s chain. */
const sweepFailureOf = (cause: unknown): RetentionSweepFailure | undefined =>
  collectCauseChain(cause).find(
    (node): node is RetentionSweepFailure => node instanceof RetentionSweepFailure
  )

/**
 * The line a failed sweep is logged with: the table and the rows that were due
 * when the executor could say, whether the database refused the write for
 * being read-only, and the reminder that the next scheduled sweep runs
 * regardless — a sweep failure never unarms its timer.
 */
export const describeSweepFailure = (prefix: string, cause: unknown): string => {
  const failure = sweepFailureOf(cause)
  const where =
    failure === undefined ? '' : `: ${failure.table}, ${String(failure.attempted)} row(s) were due`
  const mode = isReadOnlyRefusal(cause)
    ? ` — the database refused the write as read-only (SQLSTATE ${READ_ONLY_TRANSACTION_SQLSTATE}) although the sweep opened its transaction READ WRITE, which a standby or a server in recovery does`
    : ''
  return `${prefix}${where}${mode}; the next scheduled sweep runs regardless`
}

/**
 * Run `body` in one transaction that is explicitly READ WRITE on PostgreSQL —
 * `SET TRANSACTION READ WRITE` must be the transaction's first statement, so
 * it is issued here, before the body — and a plain transaction on SQLite,
 * which has no such mode. The body issues its statements through `tx`, never
 * the shared `db`: on SQLite that would wait for this very transaction.
 */
export const inReadWriteTransaction = <A>(
  body: (tx: DrizzleTransaction) => Promise<A>
): Promise<A> =>
  db.transaction(async (tx) => {
    if (!isSqliteRuntime()) await executeRaw(tx, sql`SET TRANSACTION READ WRITE`)
    return body(tx)
  })
