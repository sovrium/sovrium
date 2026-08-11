/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/utils/translation-resolver'
import { resolveRecordDrawerFields, type DerivedRecordField } from './resolve-record-drawer-fields'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataTableRowExpand } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { Tables } from '@/domain/models/app/tables'

/**
 * `rowExpand` is a shorthand for the wiring an author writes by hand today: a
 * row-click that opens a drawer, plus a sibling `record-drawer` bound to the
 * same table. So it is RESOLVED into exactly that — a synthesized drawer beside
 * the grid, and an `openDrawer` row-click pointing at it — rather than given a
 * second panel implementation inside the grid island.
 *
 * Two things follow, and both are the reason for this shape:
 *
 *  - Every behaviour the hand-wired form already has (the fetch, the save, the
 *    Escape close, the `role="dialog"` name, the read-only rendering) arrives
 *    for free and cannot drift from it, because it IS it.
 *  - A row carrying an expand is a row carrying a row action, so it stays
 *    focusable and answers Enter through the route that already exists. Nothing
 *    downstream needs to learn a second reason for a row to be interactive —
 *    which is exactly how that predicate would have silently stopped matching.
 */

/** `rowExpand` in its object form, or `undefined` when the grid does not expand. */
function normalizeRowExpand(
  rowExpand: DataTableRowExpand | undefined
):
  | { readonly fields?: readonly string[]; readonly canEdit?: boolean; readonly title?: string }
  | undefined {
  if (rowExpand === undefined || rowExpand === false) return undefined
  // `true` carries no options, so it reads as the empty object — the derived
  // panel is what `true` asks for, and every option below falls back to it.
  return rowExpand === true ? {} : rowExpand
}

/**
 * The id the synthesized drawer answers `sovrium:open-drawer` on.
 *
 * Derived from the grid's own `id`, falling back to the bound table, so it is
 * stable across renders and distinct from any drawer an author declares (which
 * would have to spell this suffix deliberately). Two ID-LESS grids bound to the
 * same table on one page would collide; giving either grid an `id` separates
 * them, which is the same answer the hand-wired form needs for the same reason.
 */
function rowExpandDrawerId(component: Component | undefined): string {
  const comp = (component ?? {}) as Record<string, unknown>
  const dataSource = comp['dataSource'] as { readonly table?: string } | undefined
  const base = (comp['id'] as string | undefined) ?? dataSource?.table ?? 'data-table'
  return `${base}-row-expand`
}

/**
 * Narrow the derived field list to the names `rowExpand.fields` declares, in
 * THAT order.
 *
 * The order is the author's, not the table's: a list is a statement about what
 * to read first. An unknown name is refused at validation, so a name that
 * matches nothing here can only be a field the table lost after decode — it is
 * dropped rather than rendered as a control bound to nothing.
 */
function narrowFields(
  derived: readonly DerivedRecordField[],
  names: readonly string[] | undefined
): readonly DerivedRecordField[] {
  if (!names) return derived
  return names.flatMap((name) => derived.filter((field) => field.name === name))
}

/**
 * The island props for a grid's synthesized expand drawer, or `undefined` when
 * the grid declares no expand.
 *
 * Field resolution goes through the SAME `resolveRecordDrawerFields` the
 * standalone drawer uses, so an expand shows what a hand-wired drawer on that
 * table shows — every declared field, in declared order, carrying each field's
 * `label` and `description`. Deriving from the grid's `columns` was refused:
 * the reason to expand a row is to see what the row cannot show.
 */
export function resolveRowExpandDrawerProps(params: {
  readonly component: Component | undefined
  readonly tables: Tables | undefined
  readonly languages: Languages | undefined
  readonly currentLang: string | undefined
}): Record<string, unknown> | undefined {
  const { component, tables, languages, currentLang } = params
  const comp = (component ?? {}) as Record<string, unknown>
  const expand = normalizeRowExpand(comp['rowExpand'] as DataTableRowExpand | undefined)
  if (!expand) return undefined
  const derived = resolveRecordDrawerFields(component, tables)
  if (!derived) return undefined
  const dataSource = comp['dataSource'] as { readonly table?: string } | undefined
  return {
    id: rowExpandDrawerId(component),
    title: expand.title ?? resolveInterpreterString('recordDrawer.title', currentLang, languages),
    role: 'dialog',
    table: dataSource?.table,
    recordFields: narrowFields(derived, expand.fields),
    canEdit: expand.canEdit !== false,
    saveLabel: resolveInterpreterString('recordDrawer.save', currentLang, languages),
    closeLabel: resolveInterpreterString('recordDrawer.close', currentLang, languages),
  }
}

/**
 * The row-click the grid island runs when the grid expands: open the drawer
 * synthesized above.
 *
 * Written in the `{ action: 'openDrawer', component }` spelling the island
 * already narrows, so `rowExpand` reaches the row through the SAME prop a
 * hand-wired `onRowClick` does. Declaring both keys is refused at validation, so
 * this never overwrites an author's own row-click.
 */
export function resolveRowExpandRowClick(
  component: Component | undefined
): { readonly action: 'openDrawer'; readonly component: string } | undefined {
  const comp = (component ?? {}) as Record<string, unknown>
  if (!normalizeRowExpand(comp['rowExpand'] as DataTableRowExpand | undefined)) return undefined
  return { action: 'openDrawer', component: rowExpandDrawerId(component) }
}
