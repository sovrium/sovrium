/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectDataTableComponents } from './table-components-service'

/**
 * The field shapes this rule reads off `app.tables[]` — raw config, so every
 * member is still a promise rather than a fact.
 */
interface RawField {
  readonly name?: unknown
  readonly type?: unknown
  readonly relatedTable?: unknown
}

type FieldsByTable = ReadonlyMap<string, readonly RawField[]>

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function collectTableFields(config: unknown): FieldsByTable {
  const tables = isRecord(config) ? config['tables'] : undefined
  if (!Array.isArray(tables)) return new Map()
  return new Map(
    tables.flatMap((table: unknown) => {
      if (!isRecord(table) || typeof table['name'] !== 'string') return []
      const fields = Array.isArray(table['fields']) ? (table['fields'] as readonly RawField[]) : []
      return [[table['name'], fields] as const]
    })
  )
}

const fieldNamesOf = (fields: readonly RawField[]): readonly string[] =>
  fields.flatMap((field) => (typeof field.name === 'string' ? [field.name] : []))

/**
 * The verdict for one `columns[]` entry that names a `displayField`.
 *
 * Two refusals, both naming the column so the author can find the line:
 *   - the column's field is not a relationship, so it has no related table to
 *     read a label from;
 *   - the related table has no field of that name — the fallback to the key
 *     would otherwise hide the typo until a reader noticed the ids.
 *
 * A column whose own field does not exist is left to the field-reference rule,
 * which already reports it; saying it twice would give one mistake two voices.
 */
function checkColumn(
  column: Readonly<Record<string, unknown>>,
  tableName: string,
  fieldsByTable: FieldsByTable
): readonly string[] {
  const { field: fieldName, displayField } = column
  if (typeof fieldName !== 'string' || typeof displayField !== 'string') return []
  const field = fieldsByTable.get(tableName)?.find((candidate) => candidate.name === fieldName)
  if (field === undefined) return []
  if (field.type !== 'relationship' || typeof field.relatedTable !== 'string') {
    return [
      `columns: displayField '${displayField}' on column '${fieldName}' needs a relationship field — '${fieldName}' is a ${String(field.type)} field of table '${tableName}', with no related table to read a label from`,
    ]
  }
  const relatedFields = fieldsByTable.get(field.relatedTable)
  if (relatedFields === undefined) return []
  const available = fieldNamesOf(relatedFields)
  if (available.includes(displayField)) return []
  return [
    `columns: displayField '${displayField}' on column '${fieldName}' is not a field of the related table '${field.relatedTable}'. Available: ${available.join(', ')}`,
  ]
}

/**
 * EXISTENCE half of the `columns[].displayField` contract — decided against
 * `app.tables[]`, which no column schema node can see, so it runs with the other
 * cross-reference sweeps of the shared decode pipeline.
 *
 * A grid bound to a system source, to a route reference or to a table the config
 * does not declare is skipped: the first two have no declared field list, and an
 * unknown table is the table rule's error to report.
 */
export function validateColumnDisplayFields(config: unknown): readonly string[] {
  const fieldsByTable = collectTableFields(config)
  return collectDataTableComponents(config).flatMap((component) => {
    const { dataSource, columns } = component
    if (!isRecord(dataSource) || typeof dataSource['table'] !== 'string') return []
    if (!Array.isArray(columns)) return []
    const tableName = dataSource['table']
    if (!fieldsByTable.has(tableName)) return []
    return columns.flatMap((column: unknown) =>
      isRecord(column) ? checkColumn(column, tableName, fieldsByTable) : []
    )
  })
}
