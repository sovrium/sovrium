/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  cascadeSoftDelete,
  cascadeSetNull,
  checkRestrictConstraint,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from './delete-helpers'
import { fetchRecordById } from './record-fetch-helpers'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * App schema slice consumed by the delete pipeline. Only the fields needed
 * for cascade / set-null / restrict checks are surfaced.
 */
export type DeleteAppSchema = {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
      readonly onDelete?: string
    }>
  }>
}

/**
 * Outcome of the delete transaction. `recordBeforeData` is non-undefined only
 * on the soft-delete success path; `restrictViolation` short-circuits before
 * any rows are touched.
 */
type DeleteTransactionOutcome = {
  readonly success: boolean
  readonly recordBeforeData: Record<string, unknown> | undefined
  readonly setNullPerformed: boolean
  readonly restrictViolation: boolean
  /** Every row the delete removed or changed — the record and its cascaded children. */
  readonly committed: readonly CommittedRowChange[]
}

/**
 * Single-arg config for the delete transaction so the helper stays under
 * `max-params`. All fields are immutable inputs.
 */
type DeleteTransactionConfig = TransactionOn & {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: DeleteAppSchema | undefined
}

/** A delete that removed nothing: the row was missing, or already in the trash. */
const NOTHING_REMOVED: DeleteTransactionOutcome = {
  success: false,
  recordBeforeData: undefined,
  setNullPerformed: false,
  restrictViolation: false,
  committed: [],
}

/**
 * Execute the delete pipeline within a single transaction:
 * 1. Reject restrict-on-delete violations deterministically.
 * 2. Pick soft-delete vs hard-delete based on the `deleted_at` column.
 * 3. On soft-delete success, cascade to dependents and run set-null helpers.
 *
 * Extracted from `deleteRecord` so the inner generator stays small enough to
 * satisfy `max-lines-per-function` without a lint disable.
 */
export async function runDeleteTransaction(
  config: Readonly<DeleteTransactionConfig>
): Promise<DeleteTransactionOutcome> {
  const { tx, dialect, session, tableName, recordId, app } = config

  if (app && (await checkRestrictConstraint({ tx, dialect }, tableName, recordId, app))) {
    return { ...NOTHING_REMOVED, restrictViolation: true }
  }

  const hasSoftDelete = await checkDeletedAtColumn({ tx, dialect }, tableName)
  const recordBeforeData = await fetchRecordById({ tx, dialect }, tableName, recordId)

  const removedRecord = (): readonly CommittedRowChange[] =>
    recordBeforeData === undefined
      ? []
      : [{ tableName, event: 'delete', recordId, previous: recordBeforeData }]

  if (!hasSoftDelete) {
    const success = await executeHardDelete({ tx, dialect }, tableName, recordId)
    return {
      success,
      recordBeforeData: undefined,
      setNullPerformed: false,
      restrictViolation: false,
      committed: success ? removedRecord() : [],
    }
  }

  const success = await executeSoftDelete({ tx, dialect }, tableName, recordId, session.userId)
  if (!success) return NOTHING_REMOVED

  const cascaded = app
    ? await cascadeSoftDelete({ tx, dialect }, tableName, recordId, app, session.userId)
    : []
  const setNull = app
    ? await cascadeSetNull({ tx, dialect }, tableName, recordId, app)
    : { performed: false, changes: [] }
  return {
    success: true,
    recordBeforeData,
    setNullPerformed: setNull.performed,
    restrictViolation: false,
    committed: [...removedRecord(), ...cascaded, ...setNull.changes],
  }
}
