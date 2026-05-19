/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectCycles } from '@/domain/validators/cycle-detection'

export const autoGenerateTableIds = (
  tables: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> => {
  const maxId = tables.reduce((max, table) => {
    if (table.id !== undefined && typeof table.id === 'number') {
      return Math.max(max, table.id)
    }
    return max
  }, 0)

  const { tablesWithIds } = tables.reduce<{
    tablesWithIds: ReadonlyArray<Record<string, unknown>>
    nextId: number
  }>(
    (acc, table) => {
      if (table.id === undefined) {
        return {
          tablesWithIds: [...acc.tablesWithIds, { ...table, id: acc.nextId }],
          nextId: acc.nextId + 1,
        }
      }
      return {
        ...acc,
        tablesWithIds: [...acc.tablesWithIds, table],
      }
    },
    { tablesWithIds: [], nextId: maxId + 1 }
  )

  return tablesWithIds
}

export const detectCircularRelationships = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly relatedTable?: string
      readonly relationType?: string
      readonly required?: boolean
    }>
  }>
): ReadonlyArray<string> => {
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const relatedTables = table.fields
        .filter(
          (field) =>
            field.type === 'relationship' &&
            field.relatedTable !== undefined &&
            field.relatedTable !== table.name &&
            (field.relationType === 'many-to-one' || field.relationType === undefined) &&
            field.required !== false
        )
        .map((field) => field.relatedTable as string)
      return [table.name, relatedTables] as const
    })
  )

  return detectCycles(dependencyGraph)
}

export const detectCircularPermissionInheritance = (
  tables: ReadonlyArray<{
    readonly name: string
    readonly permissions?: {
      readonly inherit?: string
    }
  }>
): ReadonlyArray<string> => {
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    tables.map((table) => {
      const inheritFrom = table.permissions?.inherit
      return [table.name, inheritFrom ? [inheritFrom] : []] as const
    })
  )

  return detectCycles(dependencyGraph)
}
