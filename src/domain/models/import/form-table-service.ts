/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A migrated form's responses table, in the shape the table half of the import
 * produces: its `tables[]` entry, and the source table whose records the seed
 * path writes. Each response is one record, keyed by the response's own id,
 * which is also its `source_id`, so a re-import updates the same rows.
 *
 * A response's hidden-field and variable values sit beside its answers, under
 * the keys the columns read them from (`hidden:<name>`, `variable:<name>`).
 */

import { SOURCE_ID_FIELD } from './field-type-mappings'
import { hiddenKey, variableKey, type FormColumn } from './form-columns-service'
import type { CanonicalField, CanonicalTable, CanonicalValue } from './canonical-base'
import type { CanonicalForm } from './canonical-form'
import type { MappedTable } from './table-mapper-service'

const SOURCE_ID_ENTRY = {
  name: SOURCE_ID_FIELD,
  label: 'Source ID',
  type: 'single-line-text',
  unique: true,
} as const

/** One response's values, keyed as the columns read them. */
const valuesOf = (
  response: CanonicalForm['responses'][number]
): Readonly<Record<string, CanonicalValue>> => ({
  ...response.answers,
  ...Object.fromEntries(
    Object.entries(response.hidden ?? {}).map(([name, value]) => [hiddenKey(name), value])
  ),
  ...Object.fromEntries(
    Object.entries(response.variables ?? {}).map(([name, value]) => [variableKey(name), value])
  ),
})

/** The responses table of one form. */
export const formTableOf = (
  form: CanonicalForm,
  name: string,
  id: number,
  columns: readonly FormColumn[]
): MappedTable => {
  const fields: readonly CanonicalField[] = columns.map((column) => ({
    sourceId: column.key,
    name: column.label,
    sourceType: column.sourceType,
  }))
  const keys = new Set(columns.map((column) => column.key))
  const source: CanonicalTable = {
    sourceId: `${form.tool}:${form.sourceId}`,
    name: form.title,
    fields,
    views: [],
    records: form.responses.map((response) => ({
      sourceId: response.sourceId,
      values: Object.fromEntries(
        Object.entries(valuesOf(response)).filter(([key]) => keys.has(key))
      ),
      createdAt: response.submittedAt,
    })),
  }
  const entries = columns.map((column, index) => ({
    id: index + 1,
    name: column.name,
    label: column.label,
    type: column.type,
    ...(column.question?.description === undefined
      ? {}
      : { description: column.question.description }),
    ...column.settings,
  }))
  return {
    source,
    name,
    entry: {
      id,
      name,
      fields: [...entries, { id: columns.length + 1, ...SOURCE_ID_ENTRY }],
    },
    fields: columns.map((column, index) => ({
      source: fields[index] ?? { sourceId: column.key, name: column.label, sourceType: 'answer' },
      name: column.name,
      type: column.type,
      seeded: true,
    })),
  }
}
