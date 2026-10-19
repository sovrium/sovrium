/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { findUndeclaredSingleSelectValues } from '@/domain/models/app/tables/single-select-values-validation'
import { FieldFormatError, ValidationContext } from '../middleware/validation'

/**
 * Reject a `single-select` or `status` value that is not a declared option.
 *
 * The rule itself is {@link findUndeclaredSingleSelectValues}. Both engines hold
 * a member CHECK on these columns, so the value never persisted — but without
 * this rule it reached the INSERT and came back from the driver seam as a 400
 * naming no column. This answers the field-scoped 422 `FieldFormatError` the
 * `multi-select` membership rule (`validateMultiSelectOptions`) answers, with
 * the same message shape and every offender in `errors`.
 */
export function validateSingleSelectOptions(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldFormatError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const undeclared = findUndeclaredSingleSelectValues(table.fields, fields).map((violation) => ({
      field: violation.field,
      message: `Invalid option for field '${violation.field}'. Allowed options: ${violation.allowed.join(', ')}`,
    }))

    const firstUndeclared = undeclared[0]
    if (firstUndeclared) {
      return yield* Effect.fail(
        new FieldFormatError(firstUndeclared.message, firstUndeclared.field, undeclared)
      )
    }
  })
}
