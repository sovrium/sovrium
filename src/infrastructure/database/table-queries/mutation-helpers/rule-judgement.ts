/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A write's business rules, judged inside the write's own transaction on the
 * rows it is about to change — so two writes to one record are judged one
 * after the other, the second on what the first left.
 *
 * PostgreSQL: before reading, the transaction takes a lock per record
 * (`pg_advisory_xact_lock`, keyed by table and the id in one canonical
 * spelling, held until it commits or
 * rolls back). Every judged write of the record takes the same lock, so the
 * second waits for the first to commit, and its read then sees the committed
 * row. A row lock (`SELECT … FOR UPDATE`) is not used because a table carrying
 * a lookup, a rollup or a count is read through a view of joins, which
 * PostgreSQL refuses to lock that way. The locks are taken in id order, so two
 * batches naming the same records cannot wait on each other.
 *
 * SQLite: the runtime client runs a transaction alone, against every other
 * statement on its one connection (`sqlite-serialized-client.ts`), so the read
 * inside it already sees the row as the previous write left it. Every
 * statement here goes through `tx`.
 */

import { sql } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@/domain/errors'
import { rowAsRestored } from '@/domain/models/app/tables/business-rule-service'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { databaseTableName, tableIdentifier } from '../statement/validation'
import type {
  InTransactionRuleJudge,
  JudgedRows,
} from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/** A UUID in any spelling the record routes accept: braces, hyphens, either case. */
const UUID_SPELLING = /^\{?[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}\}?$/i

/** A serial id in any spelling the database reads as the same number. */
const SERIAL_SPELLING = /^\s*\+?0*(\d+)\s*$/

/**
 * One record id as every spelling of it reads — `05` and `5`, an upper- and a
 * lower-case UUID — so two writes naming the same record by two spellings
 * take the same lock, and a row read back is found under the id its write
 * named. Two DIFFERENT text ids folding to one form only share a lock, which
 * costs a wait, never a judgement.
 */
export const canonicalRecordId = (id: string): string => {
  const serial = SERIAL_SPELLING.exec(id)
  if (serial !== null) return serial[1] ?? id
  return UUID_SPELLING.test(id) ? id.replaceAll(/[{}-]/g, '').toLowerCase() : id
}

/** Take the per-record lock of each id, one after the other, in id order (PostgreSQL only). */
const lockRecords = (
  { tx, dialect }: TransactionOn,
  tableName: string,
  ids: readonly string[]
): Promise<void> => {
  if (dialect.kind === 'sqlite') return Promise.resolve()
  const relation = databaseTableName(tableName)
  const keys = [...new Set(ids.map(canonicalRecordId))].toSorted()
  return keys.reduce<Promise<void>>(
    (previous, id) =>
      previous.then(async () => {
        await executeRawOn(
          dialect.kind,
          tx,
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sovrium:record:${relation}:${id}`}, 0))`
        )
      }),
    Promise.resolve()
  )
}

/**
 * Which rows a write judges: the live ones (an update, a delete to the trash),
 * the ones in the trash, as they will stand once restored (a restore), or
 * every row as it is stored, in the trash or not (a permanent delete).
 */
export type JudgedState = 'live' | 'trashed' | 'any'

const isTrashed = (row: Readonly<Record<string, unknown>>) =>
  row['deleted_at'] !== undefined && row['deleted_at'] !== null

/**
 * The rows `recordIds` name, read inside the transaction after their locks
 * were taken, each keyed by the id as the write named it. For a `live` write a
 * row in the trash is left out, as a missing one is; for a `trashed` one (a
 * restore) only the rows in the trash are kept, as they will stand restored;
 * for `any` (a permanent delete) every row is kept as it is stored.
 */
export async function readJudgedRows(
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  state: JudgedState = 'live'
): Promise<JudgedRows> {
  const ids = [...new Set(recordIds.map(String))].toSorted()
  if (ids.length === 0) return new Map()
  await lockRecords(on, tableName, ids)
  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql.raw(', ')
  )
  const rows = await executeRawOn(
    on.dialect.kind,
    on.tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id IN (${idList})`
  )
  const kept = keptIn(state, rows)
  const exact = new Map(kept.map((row) => [String(row['id']), row] as const))
  const folded = new Map(kept.map((row) => [canonicalRecordId(String(row['id'])), row] as const))
  return new Map(
    ids.flatMap((id) => {
      const row = exact.get(id) ?? folded.get(canonicalRecordId(id))
      return row === undefined ? [] : [[id, row] as const]
    })
  )
}

/** The rows a write in `state` judges, of those read. */
const keptIn = (
  state: JudgedState,
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly Readonly<Record<string, unknown>>[] => {
  if (state === 'any') return rows
  if (state === 'live') return rows.filter((row) => !isTrashed(row))
  return rows.flatMap((row) => {
    const restored = rowAsRestored(row)
    return restored === undefined ? [] : [restored]
  })
}

/** The rows, once the judge let them through; its refusal thrown otherwise. */
const judged = (judge: InTransactionRuleJudge, rows: JudgedRows): JudgedRows => {
  const refusal = judge(rows)
  if (refusal !== undefined) throw refusal
  return rows
}

/**
 * Judge the write on the rows it changes, as this transaction reads them, and
 * throw the refusal — out of the transaction body, so the driver rolls back
 * and nothing is written. Answers the rows it judged.
 */
export async function judgeInTransaction(
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  judge: InTransactionRuleJudge
): Promise<JudgedRows> {
  return judged(judge, await readJudgedRows(on, tableName, recordIds))
}

/**
 * {@link judgeInTransaction} for a permanent delete: the rows read as they are
 * stored, so one already in the trash is judged as a live one is.
 */
export async function judgePermanentDeleteInTransaction(
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  judge: InTransactionRuleJudge
): Promise<JudgedRows> {
  return judged(judge, await readJudgedRows(on, tableName, recordIds, 'any'))
}

/**
 * {@link judgeInTransaction} for a restore: the rows read in the trash, as they
 * will stand once restored. A row that is not in the trash reaches the judge
 * as absent; the restore answers it.
 */
export async function judgeRestoreInTransaction(
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  judge: InTransactionRuleJudge
): Promise<JudgedRows> {
  return judged(judge, await readJudgedRows(on, tableName, recordIds, 'trashed'))
}

/** A business rule's refusal as itself; anything else as `wrap` maps it. */
export const refusalOr =
  <E>(wrap: (error: unknown) => E) =>
  (error: unknown): E | BusinessRuleViolationError =>
    error instanceof BusinessRuleViolationError ? error : wrap(error)
