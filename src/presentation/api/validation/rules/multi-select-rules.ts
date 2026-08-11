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

/**
 * Reject a `multi-select` value carrying an option the column does not declare.
 *
 * The rule itself is {@link findUndeclaredMultiSelectValues} in
 * `domain/validators/multi-select-values.ts`, shared with the update path. It
 * lives in the application layer rather than in the SQL generator because the
 * PostgreSQL member CHECK has NO SQLite counterpart — SQLite prohibits
 * subqueries inside CHECK, and no subquery-free idiom expresses "every element
 * of a JSON array is in a fixed allowlist" — so the records API is the only
 * seam where both engines can be held to one contract.
 *
 * 422 (`FieldFormatError`) is the status this codebase already assigns to
 * API-layer value pre-validation, matching `email`/`url`. It is a deliberate,
 * verified change on PostgreSQL, which previously answered this create from the
 * DB seam with a sanitized 400 naming no column at all ("A submitted value is
 * not allowed by this resource") — unusable for an inline form message.
 *
 * Every offender is reported, in table field-declaration order, matching the
 * accumulation the format rule already performs.
 *
 */
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

/**
 * Reject a `multi-select` value selecting more options than `maxSelections`
 * permits. The boundary is inclusive — a selection AT the cap is accepted.
 *
 * The rule itself is {@link findMultiSelectSelectionOverflows}. `maxSelections`
 * was inert at runtime on EVERY engine before this: the emitted PostgreSQL
 * CHECK tests membership (`<@`) and never cardinality, and the only
 * `maxSelections` logic that existed was the config-time consistency check
 * (`maxSelections <= options.length`).
 *
 * 400 (`FieldValidationError`), NOT the 422 the membership rule returns,
 * matches the closest existing precedent: `maxFiles` on a
 * `multiple-attachments` column is the same rule — a cardinality cap on an
 * array-valued column — and rejects through `FieldValidationError` in
 * `field-rules.ts`. Membership is a value-shape rule and follows the
 * `email`/`url` 422 precedent; cardinality is a declared constraint and follows
 * the 400 one.
 *
 */
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
