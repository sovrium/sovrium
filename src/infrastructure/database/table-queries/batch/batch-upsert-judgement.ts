/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How an upsert finds the record each row matches, and how the table's
 * business rules judge every row inside its transaction as what it becomes
 * there: a row matching a record, as that record's update — every matched
 * record read once its lock is held (`rule-judgement.ts`) — and a row matching
 * none, as the create of the row it inserts. Each row is judged before any row
 * is written and once more as it writes. A row that matched a record before
 * the transaction opened, and matches none inside it because that record was
 * deleted or moved off the merge key meanwhile, is therefore judged as the
 * create it has become, never inserted unjudged.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  upsertCreateKey,
  type InTransactionRuleJudge,
  type JudgedRows,
} from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import { DatabaseError } from '@/infrastructure/database'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { mergeKeyEqualsSqlOn } from '@/infrastructure/database/sql/translatable-value-sql'
import { readJudgedRows } from '../mutation-helpers/rule-judgement'
import { excludingIds } from '../query-helpers/check-existing-records'
import { validateColumnName, tableIdentifier } from '../statement/validation'
import type { BusinessRuleViolationError } from '@/domain/errors'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * Check if a LIVE record exists based on merge fields. A row in the trash, or one
 * the caller's row-level read rule hides (`hiddenIds`), is not a match: created.
 * A translatable merge field matches per language (`mergeKeyEqualsSqlOn`), the
 * way its per-language unique index identifies the row.
 */
export function findExistingRecord(
  on: TransactionOn,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  merge: { readonly fieldsToMergeOn: readonly string[]; readonly hiddenIds: readonly string[] }
): Effect.Effect<Readonly<Record<string, unknown>> | undefined, DatabaseError> {
  const { fieldsToMergeOn, hiddenIds } = merge
  const whereConditions = fieldsToMergeOn.map((field) => {
    validateColumnName(field)
    return mergeKeyEqualsSqlOn(on.dialect.kind, field, fields[field])
  })
  const whereClause = sql.join(whereConditions, sql.raw(' AND '))

  return Effect.tryPromise({
    try: async () => {
      const result = await executeRawOn(
        on.dialect.kind,
        on.tx,
        sql`SELECT * FROM ${tableIdentifier(tableName)}
             WHERE deleted_at IS NULL AND ${whereClause}${excludingIds(hiddenIds)} LIMIT 1`
      )
      return result[0]
    },
    catch: (error) => new DatabaseError(`Failed to check existing record in ${tableName}`, error),
  })
}

/**
 * The record a row is about to update, judged under the rules once its lock is
 * held, on the record as it stands there — after the rows written before it in
 * this upsert. A batch naming one merge key twice has its second row judged as
 * the update it is, on what the first left, even when the first created the
 * record. The record is keyed by the row's position, as {@link judgedUpsert}
 * keys it, so only this row is judged.
 */
export const judgedMatch = (
  on: TransactionOn,
  tableName: string,
  match: { readonly index: number; readonly existing: Readonly<Record<string, unknown>> },
  judge: InTransactionRuleJudge | undefined
): Effect.Effect<void, BusinessRuleViolationError | DatabaseError> => {
  if (judge === undefined) return Effect.void
  const recordId = String(match.existing['id'])
  return Effect.gen(function* () {
    const locked = yield* Effect.tryPromise({
      try: () => readJudgedRows(on, tableName, [recordId]),
      catch: (error) =>
        new DatabaseError(`Failed to read a record of an upsert in ${tableName}`, error),
    })
    const row = locked.get(recordId) ?? match.existing
    const refusal = judge(new Map([[String(match.index), row]]))
    if (refusal !== undefined) return yield* Effect.fail(refusal)
  })
}

/**
 * A row that matches no record, judged as the create it is about to become: on
 * exactly the row it inserts, keyed by its position under `upsertCreateKey`
 * as {@link judgedUpsert} keys it, so only this row is judged.
 */
export const judgedCreate = (
  create: { readonly index: number; readonly fields: Readonly<Record<string, unknown>> },
  judge: InTransactionRuleJudge | undefined
): Effect.Effect<void, BusinessRuleViolationError> => {
  const refusal = judge?.(new Map([[upsertCreateKey(create.index), create.fields]]))
  return refusal === undefined ? Effect.void : Effect.fail(refusal)
}

/** How many times an upsert locks the records it matched and matches again before giving up. */
const MAX_MATCH_ROUNDS = 3

/**
 * A conflict with concurrent writes the caller may simply send again: the
 * records an upsert matched kept changing under it. Carries the SQLSTATE of a
 * serialization failure, which the boundary answers `409` with a retry hint.
 */
const matchesKeptMoving = (tableName: string) =>
  new DatabaseError(`The records an upsert in ${tableName} matched kept changing`, {
    code: '40001',
  })

type MatchedRows = readonly (Readonly<Record<string, unknown>> | undefined)[]

/**
 * The record each row matches, every one of them read once its lock is held.
 * The records matched are locked (`rule-judgement.ts`) and matched again; a
 * record matched only that second time — another write moved it onto a merge
 * key meanwhile — is locked in turn, until a round matches no record whose
 * lock is not held. After {@link MAX_MATCH_ROUNDS} it fails as a conflict.
 */
const matchUnderLocks = (
  on: TransactionOn,
  tableName: string,
  recordsData: readonly Record<string, unknown>[],
  merge: { readonly fieldsToMergeOn: readonly string[]; readonly hiddenIds: readonly string[] }
) => {
  const round = (
    locked: ReadonlySet<string>,
    rounds: number
  ): Effect.Effect<MatchedRows, DatabaseError> =>
    Effect.gen(function* () {
      const matched = yield* Effect.forEach(recordsData, (fields) =>
        findExistingRecord(on, tableName, fields, merge)
      )
      const unlocked = matched.flatMap((row) =>
        row === undefined || locked.has(String(row['id'])) ? [] : [String(row['id'])]
      )
      if (unlocked.length === 0) return matched
      if (rounds >= MAX_MATCH_ROUNDS) return yield* Effect.fail(matchesKeptMoving(tableName))
      yield* Effect.tryPromise({
        try: () => readJudgedRows(on, tableName, unlocked),
        catch: (error) =>
          new DatabaseError(`Failed to read the records of an upsert in ${tableName}`, error),
      })
      return yield* round(new Set([...locked, ...unlocked]), rounds + 1)
    })
  return round(new Set(), 0)
}

/**
 * The table's business rules, judged on every row of the upsert as this
 * transaction reads the records — before any row is written, each matched
 * record read once its lock is held ({@link matchUnderLocks}): behind the
 * lock, a record another write was changing is read as that write left it.
 * A row matching a record hands the judge that record, keyed by the row's
 * position; a row matching none hands it the row it will insert, keyed by
 * `upsertCreateKey`, to be judged as a create. A refusal fails the whole
 * upsert. Each row is judged once more as it writes ({@link judgedMatch},
 * {@link judgedCreate}), on what the rows before it left.
 */
export const judgedUpsert = (
  on: TransactionOn,
  tableName: string,
  recordsData: readonly Record<string, unknown>[],
  params: {
    readonly merge: {
      readonly fieldsToMergeOn: readonly string[]
      readonly hiddenIds: readonly string[]
    }
    readonly judge: InTransactionRuleJudge | undefined
  }
): Effect.Effect<void, BusinessRuleViolationError | DatabaseError> => {
  const { merge, judge } = params
  if (judge === undefined) return Effect.void
  return Effect.gen(function* () {
    const matched = yield* matchUnderLocks(on, tableName, recordsData, merge)
    const rows: JudgedRows = new Map(
      matched.map((row, index) =>
        row === undefined
          ? ([upsertCreateKey(index), recordsData[index] ?? {}] as const)
          : ([String(index), row] as const)
      )
    )
    const refusal = judge(rows)
    if (refusal !== undefined) return yield* Effect.fail(refusal)
  })
}
