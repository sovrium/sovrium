/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A source table's saved views, as table views and report lines.
 *
 * A grid view becomes a table view with its visible fields and sorts; its
 * filters are reported, not converted. Every other kind of view (kanban,
 * calendar, gallery, form…) is reported.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { RESERVED_TABLE_NAMES } from '@/domain/models/app/tables/reserved-table-names'
import { deriveLinkTableName } from '@/domain/models/app/tables/table-derived-name-validation'
import { fitName, toSnakeName, uniqueNames } from './import-names-service'
import type { CanonicalField, CanonicalTable } from './canonical-base'
import type { ImportReport } from './import-report'

type Unmapped = ImportReport['unmapped'][number]

const gridsOf = (table: CanonicalTable) => table.views.filter((view) => view.kind === 'grid')

/** A table's grid view ids, its name first, unique in the table. */
const gridIdsOf = (table: CanonicalTable, tableName: string): readonly string[] =>
  uniqueNames(
    gridsOf(table).map((view) => `${tableName}_${toSnakeName(view.name, 'view')}`),
    'snake'
  )

/** A planned table as its view ids depend on it: its name and its many-to-many links. */
export interface ViewNamingTable {
  readonly table: CanonicalTable
  readonly name: string
  /** The Sovrium names of the tables its many-to-many links point at. */
  readonly manyToMany: readonly string[]
}

/** A view stored under another name than its own, because its own was taken. */
export interface RenamedView {
  readonly view: string
  readonly from: string
  readonly to: string
}

/** Each table's grid view ids, and the views stored under another id than their own. */
export interface PlannedViewIds {
  readonly ids: readonly string[]
  readonly renamed: readonly RenamedView[]
}

/**
 * The names a view must not be stored under: every planned table, every link
 * table a many-to-many link creates (named as the engine names it), and the
 * tables the engine serves itself.
 */
const relationNamesOf = (tables: readonly ViewNamingTable[]): ReadonlySet<string> =>
  new Set([
    ...RESERVED_TABLE_NAMES,
    ...tables.map((one) => sanitizeTableName(one.name)),
    ...tables.flatMap((one) =>
      one.manyToMany.map((target) => deriveLinkTableName(one.name, target))
    ),
  ])

/** `id`, then `id_view`, `id_view_2`…: the first one free, each cut to fit. */
const freeId = (id: string, taken: ReadonlySet<string>): string => {
  const candidate = (n: number): string =>
    n === 0 ? id : fitName(n === 1 ? `${id}_view` : `${id}_view_${String(n)}`, 'snake')
  const first = Array.from({ length: taken.size + 2 }, (_unused, n) => n).find(
    (n) => !taken.has(candidate(n))
  )
  return candidate(first ?? 0)
}

/** One grid view: its table's position, its name, and the id it asks for. */
type WantedId = { readonly table: number; readonly view: string; readonly id: string }

/**
 * Every table's grid view ids, so that no view is stored under the name of a
 * table, a link table, a name the engine serves, or another table's view: all
 * share one namespace in the database. A view whose own id is free keeps it,
 * so a rename never takes another view's own id; a view whose id is taken
 * gains `_view` (then `_view_2`…), and is listed as renamed.
 */
export const planViewIds = (tables: readonly ViewNamingTable[]): readonly PlannedViewIds[] => {
  const relations = relationNamesOf(tables)
  const wanted: readonly WantedId[] = tables.flatMap((one, table) => {
    const grids = gridsOf(one.table)
    return gridIdsOf(one.table, one.name).map((id, index) => ({
      table,
      view: grids[index]?.name ?? id,
      id: fitName(id, 'snake'),
    }))
  })
  const kept = wanted.map(
    (one, index) =>
      !relations.has(one.id) && !wanted.slice(0, index).some((other) => other.id === one.id)
  )
  const chosen = wanted.reduce<{
    readonly ids: readonly string[]
    readonly taken: ReadonlySet<string>
  }>(
    (state, one, index) => {
      if (kept[index] === true) return { ids: [...state.ids, one.id], taken: state.taken }
      const id = freeId(one.id, state.taken)
      return { ids: [...state.ids, id], taken: new Set([...state.taken, id]) }
    },
    {
      ids: [],
      taken: new Set([...relations, ...wanted.filter((_one, i) => kept[i]).map((one) => one.id)]),
    }
  ).ids
  const at = wanted.map((one, index) => ({ ...one, to: chosen[index] ?? one.id }))
  return tables.map((_one, table) => {
    const own = at.filter((one) => one.table === table)
    return {
      ids: own.map((one) => one.to),
      renamed: own
        .filter((one) => one.to !== one.id)
        .map((one) => ({ view: one.view, from: one.id, to: one.to })),
    }
  })
}

/** A renamed view as a report entry. */
export const renamedViewsUnmapped = (
  table: CanonicalTable,
  renamed: readonly RenamedView[]
): readonly Unmapped[] =>
  renamed.map((one) => ({
    domain: 'tables' as const,
    source: `${table.name} / ${one.view} (grid)`,
    kind: 'view' as const,
    reason: `A view is stored in the database under its id, and "${one.from}" is already the name of a table, a link table or another view, so this view is stored as "${one.to}".`,
    fallback: one.to,
  }))

/**
 * Grid views as table views: their visible fields and sorts. Filters are
 * reported. A view is stored as a database view, whose name is shared by every
 * table, so its id carries its table's name. A grid that lists no field it can
 * name shows every field.
 */
export const viewsEntry = (
  table: CanonicalTable,
  tableName: string,
  rows: readonly { readonly field: CanonicalField; readonly name: string }[],
  ids: readonly string[] = gridIdsOf(table, tableName)
): Readonly<Record<string, unknown>> => {
  const nameOf = new Map(rows.map((row) => [row.field.sourceId, row.name] as const))
  const grids = gridsOf(table)
  if (grids.length === 0) return {}
  return {
    views: grids.map((view, index) => {
      const fields = view.visibleFields.flatMap((id) => {
        const field = nameOf.get(id)
        return field === undefined ? [] : [field]
      })
      return {
        id: ids[index] ?? 'view',
        name: view.name,
        ...(fields.length === 0 ? {} : { fields }),
        sorts: view.sorts.flatMap((sort) => {
          const field = nameOf.get(sort.field)
          return field === undefined ? [] : [{ field, direction: sort.direction }]
        }),
      }
    }),
  }
}

/** Every view that is not a grid, and every grid filter, as a report entry. */
export const viewsUnmapped = (table: CanonicalTable): readonly Unmapped[] =>
  table.views.flatMap((view) => {
    if (view.kind !== 'grid') {
      return [
        {
          domain: 'tables' as const,
          source: `${table.name} / ${view.name} (${view.kind})`,
          kind: 'view' as const,
          reason: 'Only a grid view becomes a table view; this one is reported.',
        },
      ]
    }
    return view.filters.length === 0
      ? []
      : [
          {
            domain: 'tables' as const,
            source: `${table.name} / ${view.name} (grid)`,
            kind: 'view' as const,
            reason: "The view's filters are not converted; its fields and sorts are.",
          },
        ]
  })
