/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure half of a table field that offers only some of its select column's
 * options: which choices it serves, and which submitted value it withholds.
 *
 * A table field bound to a `single-select` or `multi-select` column may list
 * the values it offers in `options`. The list is an allow-list: it is served in
 * the order written, a `label` renames an option on this form only, and a value
 * the column holds but the list leaves out is neither served nor accepted. The
 * submit path refuses such a value exactly as it refuses a value the column does
 * not hold, so its answer does not tell the two apart.
 *
 * The shapes are structural, like the rest of the forms helpers, so this module
 * takes no `tables` import (feature isolation).
 */

/** One choice a field lists: the value it stores, and the text it shows on this form. */
export interface FormChoiceShape {
  readonly value: string
  readonly label?: string
}

/** One resolved choice: the value stored, and the text shown. */
export interface OfferedChoice {
  readonly value: string
  readonly label: string
}

/** The column types whose options a table field may narrow. */
export const NARROWABLE_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'single-select',
  'multi-select',
])

/**
 * The choices a field serves: every choice of its column when it lists none,
 * otherwise the listed ones the column holds, in the order listed, each named by
 * the field's own `label` (passed through `translate`) or else by the column's.
 *
 * @param columnChoices - The column's options, resolved to `{ value, label }`; none passes through.
 * @param allowList - The field's `options`, when it declares any.
 * @param translate - Resolves a field-level label (it may be a `$t:` key).
 */
export const offeredChoices = <Choices extends ReadonlyArray<OfferedChoice> | undefined>(
  columnChoices: Choices,
  allowList: ReadonlyArray<FormChoiceShape> | undefined,
  translate: (label: string) => string
): Choices | ReadonlyArray<OfferedChoice> => {
  if (columnChoices === undefined || allowList === undefined) return columnChoices
  return allowList.flatMap((choice) => {
    const own = columnChoices.find((candidate) => candidate.value === choice.value)
    if (own === undefined) return []
    return [
      {
        value: choice.value,
        label: choice.label === undefined ? own.label : translate(choice.label),
      },
    ]
  })
}

/** The parts of a form field the submit check reads. */
interface SubmittedFieldShape {
  readonly kind: string
  readonly column?: string
  readonly options?: ReadonlyArray<FormChoiceShape>
}

/** The submitted values of one answer, as text; nothing for an empty answer. */
const answeredValues = (answer: unknown): readonly string[] => {
  if (answer === undefined || answer === null || answer === '') return []
  if (Array.isArray(answer)) return answer.filter((item) => item !== '').map(String)
  return [String(answer)]
}

/**
 * The first table field whose answer carries a value its `options` leave out,
 * by its column (the key the body is keyed by), or `undefined` when every
 * answer is offered. One withheld value in a multi-choice answer is enough.
 *
 * @param fields - The form's fields.
 * @param body - The submitted answers, keyed by each field's submit identifier.
 */
export const findWithheldChoiceField = (
  fields: ReadonlyArray<SubmittedFieldShape>,
  body: Readonly<Record<string, unknown>>
): string | undefined =>
  fields.find((field) => {
    if (field.kind !== 'table-field' || field.column === undefined) return false
    if (field.options === undefined) return false
    const offered = new Set(field.options.map((choice) => choice.value))
    return answeredValues(body[field.column]).some((value) => !offered.has(value))
  })?.column
