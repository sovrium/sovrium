/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The value rules EVERY record write obeys, whatever road it came through: a
 * `rich-text` value is stored cleaned by the one canonical sanitizer, and an
 * `email` / `url` value is refused when it is not one.
 *
 * WHERE THESE RULES RUN, AND WHY THERE. They run in the write orchestrations
 * (`application/use-cases/tables/record-*-orchestration.ts`) — the one program
 * a single create, a single update, a batch create or update, an upsert, a CSV
 * import, a bulk update from the grid, a hosted form, a form edit link, an
 * automation step, the AI chat and the MCP tools all pass through on their way
 * to the database — and NOT door by door. Run door by door, every new door is
 * one more place to remember them, and a door that forgets them stores a
 * script address in a `url` column and raw markup in a `rich-text` one while
 * the single-record route on the same table refuses or cleans it. A rule that
 * lives where the write lives cannot be skipped by a door that forgets it.
 *
 * A door may still check FORMATS earlier, for the ORDER of its own refusals:
 * the records API's single create and update (and the MCP tools and the bulk
 * update from the grid, which run the same compositions) refuse a malformed
 * address before they store an inline attachment and before the
 * select-option, cardinality and attachment rules answer, and a hosted form
 * answers its own friendlier sentence. Such an early check is an ordering
 * device, never the guarantee — this module is.
 *
 * Only columns the write SUPPLIES are inspected, so a row already holding a
 * legacy value stays editable through its other columns.
 */

import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import {
  findColumnFormatViolations,
  type FormatConstrainedFieldType,
} from './column-formats-validation'

/** Minimal structural shape this module needs from a table's field list. */
type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

/** A write's values: column name → value. */
type WriteValues = Readonly<Record<string, unknown>>

/**
 * The developer-facing sentence for each format violation, naming the column.
 * The `url` wording is the records API's published answer; `email` mirrors it.
 * A hosted form phrases the same violation for a stranger instead, with its
 * own copy (`submit-form-format-validation.ts`).
 */
export const FIELD_FORMAT_MESSAGES: Readonly<
  Record<FormatConstrainedFieldType, (field: string) => string>
> = {
  url: (field) => `Invalid URL format for field '${field}'`,
  email: (field) => `Invalid email format for field '${field}'`,
}

/** One value a write supplied that breaks its column's format. */
export interface FieldFormatViolation {
  readonly field: string
  readonly message: string
  /** Position of the row in a bulk write, counted from 0. */
  readonly index?: number
}

/** A write's values once cleaned, and every format its values break. */
export interface CheckedWriteValues {
  readonly values: Readonly<Record<string, unknown>>
  readonly violations: readonly FieldFormatViolation[]
}

/**
 * The values with every `rich-text` string the write supplies cleaned by
 * {@link sanitizeRichTextHTML}: scripts, event handlers and script links go,
 * ordinary formatting stays. Selected by declared field TYPE, so a
 * `long-text` or `single-line-text` value holding angle brackets is left
 * byte-identical.
 */
export const cleanRichTextValues = (
  tableFields: readonly FieldDeclaration[],
  values: WriteValues
): Readonly<Record<string, unknown>> => {
  const richText = new Set(tableFields.filter((f) => f.type === 'rich-text').map((f) => f.name))
  if (!Object.keys(values).some((key) => richText.has(key))) return values
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) =>
      richText.has(key) && typeof value === 'string'
        ? [key, sanitizeRichTextHTML(value)]
        : [key, value]
    )
  )
}

/** Every format the values break, in the table's field order, each with its sentence. */
export const findFieldFormatViolations = (
  tableFields: readonly FieldDeclaration[],
  values: WriteValues
): readonly FieldFormatViolation[] =>
  findColumnFormatViolations(tableFields, values).map((violation) => ({
    field: violation.field,
    message: FIELD_FORMAT_MESSAGES[violation.type](violation.field),
  }))

/** One write's values: cleaned, and judged against their columns' formats. */
export const checkRecordWriteValues = (
  tableFields: readonly FieldDeclaration[],
  values: WriteValues
): CheckedWriteValues => ({
  values: cleanRichTextValues(tableFields, values),
  violations: findFieldFormatViolations(tableFields, values),
})

/**
 * A bulk write's rows: each cleaned, and every format any row breaks, carrying
 * the row's position — one broken row refuses the whole batch.
 */
export const checkRecordWriteRows = (
  tableFields: readonly FieldDeclaration[],
  rows: readonly WriteValues[]
): {
  readonly rows: readonly Readonly<Record<string, unknown>>[]
  readonly violations: readonly FieldFormatViolation[]
} => ({
  rows: rows.map((row) => cleanRichTextValues(tableFields, row)),
  violations: rows.flatMap((row, index) =>
    findFieldFormatViolations(tableFields, row).map((violation) => ({ ...violation, index }))
  ),
})
