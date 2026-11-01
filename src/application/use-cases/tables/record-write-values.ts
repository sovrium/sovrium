/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value rules every record write obeys, as the step the write
 * orchestrations run before anything else: `rich-text` values cleaned, `email`
 * and `url` values refused when they are not one. The rule and the reason it
 * runs here rather than at each door are `record-write-values-validation.ts`'s.
 *
 * It runs first — before the business rules (which judge the row as it will be
 * stored, so they see the cleaned values) and before any read or write, so a
 * refused write touches nothing.
 */

import { Effect } from 'effect'
import { FieldFormatViolationError } from '@/domain/errors/field-format-violation-error'
import {
  checkRecordWriteRows,
  checkRecordWriteValues,
} from '@/domain/models/app/tables/record-write-values-validation'
import type { App } from '@/domain/models/app'

/** A write's values: column name → value. */
type WriteValues = Readonly<Record<string, unknown>>

const fieldsOf = (app: App, tableName: string) =>
  app.tables?.find((table) => table.name === tableName)?.fields ?? []

/** One write's values, cleaned — or the refusal naming every malformed address. */
export const checkedWriteValues = (
  app: App,
  tableName: string,
  values: WriteValues
): Effect.Effect<WriteValues, FieldFormatViolationError> => {
  const checked = checkRecordWriteValues(fieldsOf(app, tableName), values)
  return (
    checked.violations.length > 0
      ? Effect.fail(new FieldFormatViolationError(checked.violations))
      : Effect.succeed(checked.values)
  ).pipe(Effect.withSpan('tables.check-write-values', { attributes: { tableName } }))
}

/** A bulk write's rows, each cleaned — or one refusal for the whole batch. */
export const checkedWriteRows = (
  app: App,
  tableName: string,
  rows: readonly WriteValues[]
): Effect.Effect<readonly WriteValues[], FieldFormatViolationError> => {
  const checked = checkRecordWriteRows(fieldsOf(app, tableName), rows)
  return (
    checked.violations.length > 0
      ? Effect.fail(new FieldFormatViolationError(checked.violations))
      : Effect.succeed(checked.rows)
  ).pipe(
    Effect.withSpan('tables.check-write-rows', {
      attributes: { tableName, rows: rows.length },
    })
  )
}
