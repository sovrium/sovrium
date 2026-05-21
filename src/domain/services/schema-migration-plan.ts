/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

export interface AddedTableOperation {
  readonly kind: 'create-table'
  readonly table: string
}

export interface AddedColumnOperation {
  readonly kind: 'add-column'
  readonly table: string
  readonly column: string
}

export type DeferredOperation =
  | { readonly kind: 'drop-table'; readonly table: string }
  | { readonly kind: 'drop-column'; readonly table: string; readonly column: string }
  | {
      readonly kind: 'rename-column'
      readonly table: string
      readonly from: string
      readonly to: string
    }

export interface SchemaMigrationPlan {
  readonly addedTables: ReadonlyArray<AddedTableOperation>
  readonly addedColumns: ReadonlyArray<AddedColumnOperation>
  readonly deferred: ReadonlyArray<DeferredOperation>
  readonly tablesToCreate: ReadonlyArray<Table>
  readonly columnsToAddByTable: ReadonlyArray<{
    readonly table: Table
    readonly fields: ReadonlyArray<Fields[number]>
  }>
}

const tablesOf = (app: App): readonly Table[] => app.tables ?? []

const fieldHasColumn = (field: Fields[number]): boolean => {
  if (field.type === 'button' || field.type === 'count') return false
  if (
    field.type === 'relationship' &&
    'relationType' in field &&
    field.relationType === 'one-to-many'
  ) {
    return false
  }
  if (
    field.type === 'relationship' &&
    'relationType' in field &&
    field.relationType === 'many-to-many'
  ) {
    return false
  }
  return true
}

const columnNamesOf = (table: Table): ReadonlySet<string> =>
  new Set(table.fields.filter(fieldHasColumn).map((f) => f.name))

export const classifySchemaMigration = (previous: App, next: App): SchemaMigrationPlan => {
  const prevTables = tablesOf(previous)
  const nextTables = tablesOf(next)
  const prevByName = new Map(prevTables.map((t) => [t.name, t]))
  const nextByName = new Map(nextTables.map((t) => [t.name, t]))

  const tablesToCreate = nextTables.filter((t) => !prevByName.has(t.name))
  const addedTables = tablesToCreate.map(
    (t): AddedTableOperation => ({ kind: 'create-table', table: t.name })
  )

  const droppedTables = prevTables
    .filter((t) => !nextByName.has(t.name))
    .map((t): DeferredOperation => ({ kind: 'drop-table', table: t.name }))

  const sharedTables = nextTables.filter((t) => prevByName.has(t.name))
  const columnsToAddByTable = sharedTables
    .map((nextTable) => {
      const prevTable = prevByName.get(nextTable.name)!
      const prevCols = columnNamesOf(prevTable)
      const fields = nextTable.fields.filter(
        (field) => fieldHasColumn(field) && !prevCols.has(field.name)
      )
      return { table: nextTable, fields }
    })
    .filter((entry) => entry.fields.length > 0)

  const addedColumns = columnsToAddByTable.flatMap((entry) =>
    entry.fields.map(
      (field): AddedColumnOperation => ({
        kind: 'add-column',
        table: entry.table.name,
        column: field.name,
      })
    )
  )

  const droppedColumns = sharedTables.flatMap((nextTable) => {
    const prevTable = prevByName.get(nextTable.name)!
    const nextCols = columnNamesOf(nextTable)
    return Array.from(columnNamesOf(prevTable))
      .filter((col) => !nextCols.has(col))
      .map((column): DeferredOperation => ({ kind: 'drop-column', table: nextTable.name, column }))
  })

  const deferred = [...droppedTables, ...droppedColumns]

  return {
    addedTables,
    addedColumns,
    deferred,
    tablesToCreate,
    columnsToAddByTable,
  }
}
