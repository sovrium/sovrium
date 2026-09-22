/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { findRelationshipLinkOverflows } from '@/domain/models/app/tables/relationship-links-validation'
import { FieldValidationError, ValidationContext } from '../middleware/validation'

/**
 * Reject a `relationship` write linking more records than `maxLinked` permits.
 * The boundary is inclusive — a link set AT the cap is accepted.
 *
 * The rule itself is {@link findRelationshipLinkOverflows}, shared with the
 * update path. It lives in the application layer because neither engine can
 * enforce it: a `many-to-many` link set is rows in a junction table, not a
 * column, so there is no CHECK to hang a cardinality constraint on.
 *
 * 400 (`FieldValidationError`), matching the two nearest precedents rather than
 * inventing a third answer: `maxSelections` on `multi-select` and `maxFiles` on
 * `multiple-attachments` are both cardinality caps on a list-valued column and
 * both refuse through `FieldValidationError`. The 422 (`FieldFormatError`) that
 * `multi-select` MEMBERSHIP returns is for a value-shape rule — a value the
 * column never declared — which is a different question from "too many of
 * them".
 *
 * The cap is enforced BEFORE anything is written, so a refused create leaves no
 * partially-linked row behind. Truncating to the first `maxLinked` entries was
 * refused: it silently discards links the caller asked for.
 *
 * Every offender is reported, in table field-declaration order, matching the
 * accumulation the `multi-select` rules already perform.
 *
 */
export function validateRelationshipLinkLimits(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const overflowing = findRelationshipLinkOverflows(table.fields, fields).map((overflow) => ({
      field: overflow.field,
      message: `Too many linked records for field '${overflow.field}'. max linked allowed: ${overflow.maxLinked}`,
    }))

    const firstOverflowing = overflowing[0]
    if (firstOverflowing) {
      return yield* Effect.fail(
        new FieldValidationError(firstOverflowing.message, firstOverflowing.field, overflowing)
      )
    }
  })
}
