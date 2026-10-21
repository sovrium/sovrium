/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SYNTHETIC SEED a page export draws its data-bound nodes from: a few rows
 * per table, made up from the table's own field definitions and nothing else.
 *
 * A bundle is made to be handed to someone else, so it never carries a row of
 * the instance — not even when the operator's database sits beside the config.
 * A grid drawn empty would hand a designer a page that looks nothing like the
 * one people use, so the export draws it from rows invented here instead: a
 * field named `status` reads `Open`, `In progress`, `Done`; a select field
 * cycles through its own declared options; a text field reads `Sample title 1`.
 * Where a field cannot be typed honestly — a relation, a person, a file, a
 * computed value — its cells stay empty, as a new record's would be.
 *
 * Pure: no clock, no randomness, no database. The same table yields the same
 * rows, so two exports of one config are byte-identical.
 */

import { sampleValueOf, type SpecimenFieldShape } from './specimen-sample-service'

/** How many rows the seed holds for each table. */
export const SYNTHETIC_SEED_ROWS = 3

/** Words a field's NAME suggests, in row order, for a text field that names one of them. */
const VALUES_BY_NAME: Readonly<Record<string, readonly string[]>> = {
  status: ['Open', 'In progress', 'Done'],
  state: ['Open', 'In progress', 'Done'],
  stage: ['New', 'Qualified', 'Won'],
  priority: ['High', 'Medium', 'Low'],
  category: ['General', 'Billing', 'Support'],
  type: ['General', 'Billing', 'Support'],
  country: ['France', 'Germany', 'Spain'],
  city: ['Paris', 'Berlin', 'Madrid'],
}

/** Select-like types: their values are the field's own declared options. */
const SELECT_TYPES: ReadonlySet<string> = new Set(['single-select', 'status', 'multi-select'])

/** Text types: a sample word, numbered per row. */
const TEXT_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'markdown',
])

/** Numeric types whose sample is stepped per row, so three rows do not read the same. */
const STEPPED_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'decimal',
  'currency',
  'percentage',
  'progress',
])

/** A field name as a reader writes it: `due_date` → `due date`. */
const words = (name: string): string =>
  name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()

/** The declared option values of a select-like field. */
const optionValues = (field: SpecimenFieldShape): readonly string[] =>
  (field.options ?? []).flatMap((option) =>
    typeof option === 'string' ? [option] : option.value === undefined ? [] : [option.value]
  )

/** One field's value on the row at `index`, or `undefined` where the seed cannot type it. */
const seededValueOf = (field: SpecimenFieldShape, index: number): unknown => {
  if (SELECT_TYPES.has(field.type)) {
    const options = optionValues(field)
    if (options.length === 0) return sampleValueOf(field)
    const option = options[index % options.length]
    return field.type === 'multi-select' ? [option] : option
  }
  if (TEXT_TYPES.has(field.type)) {
    const named = VALUES_BY_NAME[words(field.name)]
    return named?.[index % named.length] ?? `Sample ${words(field.name)} ${index + 1}`
  }
  const sample = sampleValueOf(field)
  if (STEPPED_TYPES.has(field.type) && typeof sample === 'number') return sample * (index + 1)
  return sample
}

/**
 * The seed rows of one table, from its field definitions alone.
 *
 * @param fields - the table's fields, as the config declares them.
 * @returns {@link SYNTHETIC_SEED_ROWS} rows, each with an `id` and one value per typed field.
 */
export const syntheticRowsOf = (
  fields: ReadonlyArray<SpecimenFieldShape>
): readonly Readonly<Record<string, unknown>>[] =>
  Array.from({ length: SYNTHETIC_SEED_ROWS }, (_, index) => ({
    id: index + 1,
    ...Object.fromEntries(
      fields.flatMap((field) => {
        const value = seededValueOf(field, index)
        return value === undefined ? [] : [[field.name, value] as const]
      })
    ),
  }))

/** A seeded value as a table cell prints it; an untyped value prints nothing. */
export const syntheticCellText = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(syntheticCellText).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? '' : String(value)
}

/** The field names a reader titles a record by, in the order they are preferred. */
const TITLE_NAMES: readonly string[] = ['title', 'name', 'label', 'subject']

/**
 * The field a seeded row is titled by: a field named like a title (`title`,
 * `name`, `label`, `subject`), else the first text field, else the first
 * field.
 */
export const syntheticTitleFieldOf = (
  fields: ReadonlyArray<SpecimenFieldShape>
): SpecimenFieldShape | undefined =>
  TITLE_NAMES.map((name) => fields.find((field) => field.name === name)).find(
    (field) => field !== undefined
  ) ??
  fields.find((field) => TEXT_TYPES.has(field.type)) ??
  fields[0]

/** A seeded row's title, as a list item or a card prints it. */
export const syntheticTitleOf = (
  fields: ReadonlyArray<SpecimenFieldShape>,
  row: Readonly<Record<string, unknown>>
): string => {
  const field = syntheticTitleFieldOf(fields)
  return field === undefined ? '' : syntheticCellText(row[field.name])
}
