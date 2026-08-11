/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical format constraints for format-carrying column TYPES (`email`,
 * `url`), shared by every write path that accepts values for them.
 *
 * Why this module exists: the rule was previously implemented twice, with
 * DISJOINT coverage. `presentation/api/validation/rules/field-rules.ts`
 * validated `url` and never `email`; `application/use-cases/forms/
 * submit-form-format-validation.ts` validated `email` and never `url` — while
 * its own docstring claimed to "mirror" the other and asserted that `url` "is
 * enforced by the existing validateFieldFormats". It was not. Neither type
 * compiles to a CHECK constraint (`sql/sql-type-mappings.ts` emits a bare
 * VARCHAR(255)/TEXT, and `sql/sql-check-constraints.ts` has no `email` or `url`
 * branch), so no later layer refused the value either: a malformed address
 * reached the records API as 201-and-persisted, and a malformed URL reached a
 * form submission the same way. Both were verified by execution before this
 * module was written.
 *
 * Callers own their own error envelope and user-facing copy — this module
 * reports WHICH columns violate their declared format and of WHICH type, never
 * how to phrase it. The records API needs every offender (to fill the `errors[]`
 * array) and speaks in developer terms naming the column; a public form shows
 * one friendly message next to the offending input. Single-sourcing the RULE
 * while leaving the COPY at the boundary is deliberate: unifying the strings
 * would have pushed `Invalid email format for field 'email'` into a contact
 * form that a stranger fills in.
 */

import { isValidEmail } from '@/domain/utils/email-validation'

/**
 * Column types that carry a format constraint. A type absent from this list is
 * unconstrained — adding one here is the single edit that enables it on EVERY
 * write path at once, which is the whole point of the module.
 */
export const FORMAT_CONSTRAINED_FIELD_TYPES = ['email', 'url'] as const

/** A column type carrying a format constraint. */
export type FormatConstrainedFieldType = (typeof FORMAT_CONSTRAINED_FIELD_TYPES)[number]

/** One column whose supplied value violates its declared format. */
export type ColumnFormatViolation = {
  readonly field: string
  readonly type: FormatConstrainedFieldType
}

/** Minimal structural shape this module needs from a table's field list. */
type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

/**
 * True when `value` parses as an absolute URL carrying a protocol.
 *
 * Scheme-less input (`example.com`) is REJECTED — `new URL()` throws without a
 * scheme. That strictness is deliberate and preserved verbatim from the records
 * path, where it is the established behaviour that
 * [internal ref] assert against (`'not-a-valid-url'`).
 * A `url` column's value ends up in an `href`; a scheme-less one renders as a
 * RELATIVE link and silently resolves against the current origin, so accepting
 * it would store a value that looks fine and navigates wrong. Loosening here
 * would also make the forms path accept values the records path rejects —
 * re-creating the very asymmetry this module exists to remove.
 */
export const isWellFormedUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol.length > 0
  } catch {
    return false
  }
}

const FORMAT_PREDICATES: Readonly<Record<FormatConstrainedFieldType, (value: string) => boolean>> =
  {
    email: isValidEmail,
    url: isWellFormedUrl,
  }

const isFormatConstrained = (type: string): type is FormatConstrainedFieldType =>
  (FORMAT_CONSTRAINED_FIELD_TYPES as readonly string[]).includes(type)

/**
 * Classify one supplied value against its column's declared format.
 *
 * `undefined` / `null` / `''` mean NO VALUE WAS SUPPLIED and are skipped:
 * emptiness is the `required` rule's concern (`findBlankRequiredFields`), and
 * an optional column left blank must not report "invalid format". A non-string
 * is a violation — a number or object in an `email`/`url` column is not a
 * malformed address, but it is certainly not a valid one.
 */
const violatesFormat = (type: FormatConstrainedFieldType, value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false
  if (typeof value !== 'string') return true
  return !FORMAT_PREDICATES[type](value)
}

/**
 * Every column in `values` whose declared type carries a format constraint and
 * whose supplied value violates it, in table field-declaration order.
 *
 * Only columns PRESENT in `values` are inspected (`field.name in values`). This
 * is a hard requirement, not an optimisation: it is what makes the rule safe to
 * run on a partial update. A row already holding a malformed address from before
 * this rule existed must stay editable — validating absent columns would make
 * every write to an unrelated column of that row fail, turning a legacy data
 * problem into a hard outage.
 */
export const findColumnFormatViolations = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly ColumnFormatViolation[] =>
  tableFields
    .filter(
      (field) =>
        isFormatConstrained(field.type) &&
        field.name in values &&
        violatesFormat(field.type, values[field.name])
    )
    .map((field) => ({ field: field.name, type: field.type as FormatConstrainedFieldType }))
