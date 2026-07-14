/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { getViewBodyReferencedTables, shouldUseView } from '../lookup/lookup-view-generators'
import { isRelationshipField, relationshipFieldCreatesForeignKey } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'

export const detectCircularDependenciesWithOptionalFK = (
  tables: readonly Table[]
): ReadonlySet<string> => {
  const tablesByName = new Map(tables.map((t) => [t.name, t]))
  const circularTableNames = tables.flatMap((table) => {
    const optionalRelationships = table.fields.filter(
      (field): field is typeof field & { relatedTable: string } =>
        isRelationshipField(field) &&
        field.relatedTable !== table.name &&
        field.required === false
    )

    return optionalRelationships.flatMap((field) => {
      const relatedTableName = field.relatedTable
      const relatedTable = tablesByName.get(relatedTableName)

      if (!relatedTable) return []

      const hasReverseRelationship = relatedTable.fields.some(
        (f) => isRelationshipField(f) && f.relatedTable === table.name
      )

      return hasReverseRelationship ? [table.name, relatedTableName] : []
    })
  })

  return new Set(circularTableNames)
}

export const sortTablesByDependencies = (tables: readonly Table[]): readonly Table[] => {
  const tableMap = new Map(tables.map((t) => [t.name, t]))

  const initialDeps = new Map(
    tables.map((table) => {
      const deps = new Set(
        table.fields
          .filter(isRelationshipField)
          .filter(relationshipFieldCreatesForeignKey)
          .map((f) => f.relatedTable)
          .filter((name): name is string => name !== undefined && name !== table.name)
      )
      return [table.name, deps]
    })
  )

  const processTable = (
    current: string,
    remaining: ReadonlyMap<string, Set<string>>,
    sorted: readonly Table[]
  ): readonly Table[] => {
    const table = tableMap.get(current)
    if (!table) return sorted

    const newSorted = [...sorted, table]

    const updated = new Map(
      Array.from(remaining.entries()).map(([name, deps]) => {
        const newDeps = new Set(deps)
        newDeps.delete(current)
        return [name, newDeps]
      })
    )

    updated.delete(current)

    const next = Array.from(updated.entries()).find(([, deps]) => deps.size === 0)

    if (next) {
      return processTable(next[0], updated, newSorted)
    }

    if (updated.size > 0) {
      return [...newSorted, ...tables.filter((t) => !newSorted.includes(t) && updated.has(t.name))]
    }

    return newSorted
  }

  const first = Array.from(initialDeps.entries()).find(([, deps]) => deps.size === 0)

  if (first) {
    return processTable(first[0], initialDeps, [])
  }

  return tables
}

export const sortTablesByViewDependencies = (tables: readonly Table[]): readonly Table[] => {
  const viewBackedNames = new Set(tables.filter((t) => shouldUseView(t)).map((t) => t.name))
  if (viewBackedNames.size < 2) return tables

  const viewDeps = new Map(
    tables.map((t) => {
      const deps = shouldUseView(t)
        ? Array.from(getViewBodyReferencedTables(t, tables)).filter(
            (name) => viewBackedNames.has(name) && name !== t.name
          )
        : []
      return [t.name, new Set(deps)] as const
    })
  )

  const emit = (emitted: readonly Table[]): readonly Table[] => {
    const emittedNames = new Set(emitted.map((t) => t.name))
    const ready = tables.filter(
      (t) =>
        !emittedNames.has(t.name) &&
        Array.from(viewDeps.get(t.name) ?? new Set<string>()).every((dep) => emittedNames.has(dep))
    )
    if (ready.length === 0) {
      return [...emitted, ...tables.filter((t) => !emittedNames.has(t.name))]
    }
    const next = [...emitted, ...ready]
    return next.length === tables.length ? next : emit(next)
  }

  return emit([])
}
