/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { collectTableFields, type FieldsByTable } from './column-display-field-validation'
import { collectDataTableComponents } from './table-components-service'

/** The field types a faceted filter can list: their options are declared. */
const FACETABLE_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function checkFacet(
  facet: string,
  tableName: string,
  fieldsByTable: FieldsByTable
): readonly string[] {
  const field = fieldsByTable.get(tableName)?.find((candidate) => candidate.name === facet)
  if (field === undefined) {
    return [`toolbar.facets: '${facet}' is not a field of table '${tableName}'`]
  }
  if (typeof field.type === 'string' && FACETABLE_TYPES.has(field.type)) return []
  return [
    `toolbar.facets: '${facet}' is a ${String(field.type)} field of table '${tableName}' — a facet lists a single-select or status field's options`,
  ]
}

function checkComponent(
  component: Readonly<Record<string, unknown>>,
  fieldsByTable: FieldsByTable
): readonly string[] {
  const { toolbar, dataSource } = component
  const facets = isRecord(toolbar) ? toolbar['facets'] : undefined
  if (!Array.isArray(facets) || facets.length === 0 || !isRecord(dataSource)) return []
  if (dataSource['system'] !== undefined) {
    return ['toolbar.facets: a grid bound to a read endpoint has no table fields to facet']
  }
  const tableName = dataSource['table']
  if (typeof tableName !== 'string' || !fieldsByTable.has(tableName)) return []
  return facets.flatMap((facet: unknown) =>
    typeof facet === 'string' ? checkFacet(facet, tableName, fieldsByTable) : []
  )
}

/**
 * `toolbar.facets` names fields of the bound table whose options a checklist
 * can list: a single-select or a status field. Any other entry, an entry the
 * table does not have, and a facet on a read-endpoint grid are refused at load.
 */
export function validateToolbarFacets(config: unknown): readonly string[] {
  const fieldsByTable = collectTableFields(config)
  return collectDataTableComponents(config).flatMap((component) =>
    checkComponent(component, fieldsByTable)
  )
}
