/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { databaseTableName } from '../statement/validation'
import { BatchValidationError } from './batch-helpers'

/** The checks an upsert passes before it writes anything. */

/**
 * Validate merge fields are present in all records
 */
export function validateMergeFieldsPresent(
  recordsData: readonly Record<string, unknown>[],
  fieldsToMergeOn: readonly string[]
): Effect.Effect<void, BatchValidationError> {
  const errors = recordsData.flatMap((record, index) => {
    const missingFields = fieldsToMergeOn.filter((field) => !(field in record))
    return missingFields.length > 0
      ? [`Record ${index}: Missing merge field(s) ${missingFields.join(', ')}`]
      : []
  })

  if (errors.length > 0) {
    return Effect.fail(
      new BatchValidationError({
        message: 'Batch validation failed',
        details: errors,
      })
    )
  }

  return Effect.void
}

/**
 * The columns a create must supply: NOT NULL columns that have no DB-side
 * default, minus the system fields the insert fills itself. Queried ONCE per
 * batch (dialect-aware) — the table's shape does not change between records.
 */
async function requiredFieldsOf(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<readonly string[]> {
  const columns = await listTableColumns(tx, databaseTableName(tableName))
  // System fields that are auto-generated (exclude from validation). The
  // literal author columns are filled by `injectCreateAuthorship` on insert.
  const autoFields = new Set(['id', 'created_at', 'updated_at', 'created_by', 'updated_by'])
  return columns
    .filter((col) => !col.isNullable && col.columnDefault === null)
    .map((col) => col.name)
    .filter((field) => !autoFields.has(field))
}

/** The required fields a record (for creates) lacks — a NOT NULL violation in waiting. */
const missingRequiredFieldsIn = (
  requiredFields: readonly string[],
  record: Readonly<Record<string, unknown>>,
  recordIndex: number
): readonly string[] => {
  const missingFields = requiredFields.filter((field) => !(field in record))
  return missingFields.length > 0
    ? [`Record ${recordIndex}: Missing required field(s) ${missingFields.join(', ')}`]
    : []
}

/**
 * Validate all records have required fields BEFORE processing
 */
export function validateAllRecordsHaveRequiredFields(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<void, BatchValidationError> {
  return Effect.gen(function* () {
    if (recordsData.length === 0) return
    const requiredFields = yield* Effect.tryPromise({
      try: () => requiredFieldsOf(tx, tableName),
      catch: (error) =>
        new BatchValidationError({
          message: 'Failed to validate record',
          details: [String(error)],
        }),
    })
    const allErrors = recordsData.flatMap((record, index) =>
      missingRequiredFieldsIn(requiredFields, record, index)
    )

    if (allErrors.length > 0) {
      return yield* new BatchValidationError({
        message: 'Batch validation failed',
        details: allErrors,
      })
    }
  })
}

/** An upsert with no record, or nothing to match records on, is refused before any work. */
export const refuseEmptyUpsert = (
  recordsData: readonly Record<string, unknown>[],
  fieldsToMergeOn: readonly string[]
): Effect.Effect<void, DatabaseError> => {
  if (recordsData.length === 0) {
    return Effect.fail(new DatabaseError('Cannot upsert batch with no records', undefined))
  }
  return fieldsToMergeOn.length === 0
    ? Effect.fail(new DatabaseError('Cannot upsert without merge fields', undefined))
    : Effect.void
}
