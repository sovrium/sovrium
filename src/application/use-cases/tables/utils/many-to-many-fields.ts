/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'


type SchemaField = {
  readonly name?: unknown
  readonly type?: unknown
  readonly relationType?: unknown
  readonly relatedTable?: unknown
}

export interface ManyToManyFieldSpec {
  readonly fieldName: string
  readonly relatedTable: string
  readonly hasReciprocal: boolean
}

const isManyToManyField = (
  field: SchemaField
): field is {
  name: string
  type: 'relationship'
  relationType: 'many-to-many'
  relatedTable: string
} =>
  field.type === 'relationship' &&
  field.relationType === 'many-to-many' &&
  typeof field.relatedTable === 'string' &&
  typeof field.name === 'string'

const relatedTablePointsBack = (
  tables: App['tables'],
  relatedTable: string,
  sourceTable: string
): boolean => {
  const target = tables?.find((t) => t.name === relatedTable)
  if (!target) return false
  return target.fields.some(
    (field) => isManyToManyField(field) && field.relatedTable === sourceTable
  )
}

export const getManyToManyFieldSpecs = (
  tables: App['tables'],
  tableName: string
): readonly ManyToManyFieldSpec[] => {
  const table = tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields.filter(isManyToManyField).map((field) => ({
    fieldName: field.name,
    relatedTable: field.relatedTable,
    hasReciprocal: relatedTablePointsBack(tables, field.relatedTable, tableName),
  }))
}
