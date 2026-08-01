/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  findMultiSelectSelectionOverflows,
  findUndeclaredMultiSelectValues,
} from '@/domain/validators/multi-select-values'
import {
  FieldFormatError,
  FieldValidationError,
  ValidationContext,
} from '../../middleware/validation'

export function validateMultiSelectOptions(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldFormatError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const undeclared = findUndeclaredMultiSelectValues(table.fields, fields).map((violation) => ({
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

export function validateMultiSelectSelectionLimits(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const overflowing = findMultiSelectSelectionOverflows(table.fields, fields).map((overflow) => ({
      field: overflow.field,
      message: `Too many selections for field '${overflow.field}'. max selections allowed: ${overflow.maxSelections}`,
    }))

    const firstOverflowing = overflowing[0]
    if (firstOverflowing) {
      return yield* Effect.fail(
        new FieldValidationError(firstOverflowing.message, firstOverflowing.field, overflowing)
      )
    }
  })
}
