/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The business-rule door (`business-rule-gate.ts`) for each bulk write: every
 * row of the batch judged before any is written, the whole batch refused once
 * with each violating row's position and id. A batch update or delete reads
 * the rows as they stand, a batch restore the rows in the trash as they will
 * stand restored, and an upsert the row each record would update — only for a
 * table that declares rules. A batch update, delete or restore and an upsert
 * answer the same rules for the write to judge again INSIDE its transaction,
 * on the rows as they stand there, so a batch racing another write to one of
 * its records is judged on what that write left.
 */

import { Effect } from 'effect'
import {
  upsertCreateKey,
  type JudgedRows,
} from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { rowAsRestored, tableDeclaresRules } from '@/domain/models/app/tables/business-rule-service'
import { upsertUpdateChange } from '@/domain/models/app/tables/insert-only-field-service'
import {
  authorizeBusinessRules,
  prepareRuleJudge,
  refuseUnderRules,
} from './permissions/business-rule-gate'
import { upsertLinkTargetWrite } from './upsert-link-target-write'
import { stampUpsertRows } from './upsert-row-stamping'
import type { RuleJudgeScope, RuleWrite } from './permissions/business-rule-gate'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'

type StoredRow = Readonly<Record<string, unknown>>

/** The table a bulk write addresses, and who makes it. */
export interface BatchRuleScope {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  /**
   * The writer's role, read against `exemptRoles` and, with `userGroups`, to
   * keep a refusal from naming a field she may not read.
   */
  readonly userRole?: string | undefined
  readonly userGroups?: readonly string[] | undefined
}

/** The table and the writer the rules judge a bulk write for. */
const judgeScope = (scope: BatchRuleScope): RuleJudgeScope => ({
  ...{ app: scope.app, tableName: scope.tableName, userId: scope.session.userId },
  ...(scope.userRole === undefined ? {} : { userRole: scope.userRole }),
  ...(scope.userGroups === undefined ? {} : { userGroups: scope.userGroups }),
})

const judged = (scope: BatchRuleScope, writes: readonly RuleWrite[]) =>
  authorizeBusinessRules({ ...judgeScope(scope), writes })

/** The stored row of `id`, `undefined` when it cannot be read (the write reports it). */
const storedRow = (scope: BatchRuleScope, id: string) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    return (yield* repo.getRecord(scope.session, scope.tableName, id)) ?? undefined
  })

/** The trashed row of `id` as it will stand restored, `undefined` when it is not in the trash. */
const trashedRow = (scope: BatchRuleScope, id: string) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    return rowAsRestored(yield* repo.getRecord(scope.session, scope.tableName, id, true))
  })

/** Refuse a batch create a rule forbids. */
export const authorizeBatchCreateRules = (scope: BatchRuleScope, rows: readonly StoredRow[]) =>
  judged(
    scope,
    rows.map((change, index) => ({ op: 'create', change, index }))
  ).pipe(Effect.withSpan('tables.authorize-batch-create-rules'))

/**
 * The table's rules over a batch's rows: judged now on the rows as they stand,
 * then answered for the write to judge again inside its transaction —
 * `undefined` for a table without rules. `writesOf` turns rows into writes.
 */
const judgedBatch = Effect.fn('tables.judged-batch')(function* (
  scope: BatchRuleScope,
  ids: readonly string[],
  writesOf: (rows: JudgedRows) => readonly RuleWrite[],
  read: typeof storedRow = storedRow
) {
  if (!tableDeclaresRules(scope.app, scope.tableName)) return undefined
  const judge = yield* prepareRuleJudge(judgeScope(scope), writesOf)
  const stored = yield* Effect.forEach(ids, (id) =>
    Effect.map(read(scope, id), (existing) => [id, existing] as const)
  )
  const rows: JudgedRows = new Map(
    stored.flatMap(([id, existing]) => (existing === undefined ? [] : [[id, existing] as const]))
  )
  yield* refuseUnderRules(judge, rows)
  return judge
})

/** One row of a bulk write as the rules judge it, its stored row when there is one. */
const rowWrite = (
  rows: JudgedRows,
  write: Omit<RuleWrite, 'existing'> & { readonly recordId: string }
): RuleWrite => {
  const existing = rows.get(write.recordId)
  return existing === undefined ? write : { ...write, existing }
}

/**
 * Refuse a batch update a rule forbids, each record judged on its stored row,
 * and answer the rules for the write to judge again inside its transaction.
 */
export const authorizeBatchUpdateRules = (
  scope: BatchRuleScope,
  records: readonly { readonly id: string; readonly fields?: StoredRow }[]
) =>
  judgedBatch(
    scope,
    records.map((record) => record.id),
    (rows) =>
      records.map((record, index) =>
        rowWrite(rows, { op: 'update', change: record.fields ?? {}, index, recordId: record.id })
      )
  ).pipe(Effect.withSpan('tables.authorize-batch-update-rules'))

/** The stored row of `id`, in the trash or not, as a permanent delete reaches it. */
const storedRowAnyState = (scope: BatchRuleScope, id: string) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    return (yield* repo.getRecord(scope.session, scope.tableName, id, true)) ?? undefined
  })

/**
 * Refuse a batch delete a lock blocking `delete` forbids, and answer the rules
 * for the delete to judge again inside its transaction. A permanent delete
 * judges a record already in the trash too.
 */
export const authorizeBatchDeleteRules = (
  scope: BatchRuleScope,
  ids: readonly string[],
  permanent = false
) =>
  judgedBatch(
    scope,
    ids,
    (rows) =>
      ids.map((id, index) => rowWrite(rows, { op: 'delete', change: {}, index, recordId: id })),
    permanent ? storedRowAnyState : storedRow
  ).pipe(Effect.withSpan('tables.authorize-batch-delete-rules'))

/**
 * Refuse a batch restore a rule forbids, each record judged as an update that
 * changes no field on its trashed row, and answer the rules for the restore to
 * judge again inside its transaction.
 */
export const authorizeBatchRestoreRules = (scope: BatchRuleScope, ids: readonly string[]) =>
  judgedBatch(
    scope,
    ids,
    (rows) =>
      ids.map((id, index) => rowWrite(rows, { op: 'restore', change: {}, index, recordId: id })),
    trashedRow
  ).pipe(Effect.withSpan('tables.authorize-batch-restore-rules'))

/**
 * The upsert's rows as the write judges them inside its transaction: a row
 * that matched a record, under its position, judged as that record's update;
 * a row that matches none, under `upsertCreateKey`, judged as a create of the
 * row it inserts — even when it matched a record before the transaction
 * opened and that record has since been deleted or moved off the merge key.
 */
const upsertWrites =
  (updates: readonly StoredRow[]) =>
  (rows: JudgedRows): readonly RuleWrite[] =>
    updates.flatMap((change, index): readonly RuleWrite[] => {
      const existing = rows.get(String(index))
      if (existing !== undefined) {
        return [{ op: 'update', existing, change, index, recordId: String(existing['id']) }]
      }
      const created = rows.get(upsertCreateKey(index))
      return created === undefined ? [] : [{ op: 'create', change: created, index }]
    })

/**
 * Refuse an upsert a rule forbids: a record matching a row by its merge fields
 * is judged as that row's update, any other as a create. Answers the rules for
 * the upsert to judge every row again inside its transaction, as what it
 * becomes there: the update of the record it matches as it stands there, or
 * the create of the row it inserts — `undefined` for a table without rules.
 *
 * Each row is judged as the upsert writes it: stamped as `upsertProgram` stamps
 * it (`stampUpsertRows`, pure, so both read the same rows), and an update
 * without its merge keys and insert-only columns (`upsertUpdateChange`), the
 * change the write sends.
 */
export const authorizeUpsertRules = Effect.fn('tables.authorize-upsert-rules')(function* (
  scope: BatchRuleScope,
  params: {
    readonly recordsData: readonly StoredRow[]
    readonly fieldsToMergeOn: readonly string[]
    readonly hiddenIds?: readonly string[] | undefined
  }
) {
  if (!tableDeclaresRules(scope.app, scope.tableName)) return undefined
  const toWrite = upsertLinkTargetWrite(yield* TableRepository, scope.session, scope.tableName, {
    fieldsToMergeOn: params.fieldsToMergeOn,
    hiddenIds: params.hiddenIds ?? [],
  })
  const { recordsData: stamped, insertOnlyFields } = stampUpsertRows(
    scope.session.userId,
    scope.app,
    scope.tableName,
    params.recordsData
  )
  const merge = { fieldsToMergeOn: params.fieldsToMergeOn, insertOnlyFields }
  const writes = yield* Effect.forEach(stamped, (change, index) => {
    const { held } = toWrite(change)
    if (held === undefined) return Effect.succeed<RuleWrite>({ op: 'create', change, index })
    return Effect.map(held, (existing): RuleWrite =>
      existing === undefined || existing === null
        ? { op: 'create', change, index }
        : {
            op: 'update',
            existing,
            change: upsertUpdateChange(change, merge),
            index,
            recordId: String(existing['id']),
          }
    )
  })
  yield* judged(scope, writes)
  return yield* prepareRuleJudge(
    judgeScope(scope),
    upsertWrites(stamped.map((row) => upsertUpdateChange(row, merge)))
  )
})
