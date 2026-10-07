/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a table-bound grid tells ITS reader about its table.
 *
 * The island payload is serialised into the page, so anything it carries is
 * readable with "view source" — it must say no more than the table API says
 * the same reader. The data-source pass stamps that API's own answer onto the
 * grid as `props._callerTable` (`withCallerTableView`, `data-source-modes.ts`):
 * the map `GET /api/tables/:t/permissions` answers her (and, for a grid bound
 * to a view, that view as `GET /api/tables/:t/views/:v` answers her). This
 * module is the ONE place the grid's inputs are narrowed to it:
 *
 *  - `tablePermissions`: her permission map, in place of the table's block;
 *  - `tableFields` / `fieldMeta`: only the fields her map lets her read;
 *  - each `fieldMeta` entry on a field her map does not let her write is
 *    marked `readOnly`: the island offers an input — an auto column's editor,
 *    the add-row line, the create modal — on the others alone;
 *  - the configured columns: none on a field her map does not let her read
 *    (`readableColumnsOf`, applied where the stamp is made), and no inline
 *    input on one it does not let her write.
 *
 * Every per-reader field decision reads the map's `fields`, which is the
 * records API's own read and write predicates — so a surface that later needs
 * the same narrowing (the row-expand drawer, the related-records drawer, an
 * edit form's field list) takes it from {@link readableFieldsOf} /
 * {@link writableFieldsOf} rather than from a check of its own.
 *
 * Without a stamp — no auth configured, or a render outside the page route
 * funnel (the operator console's mounted surfaces, a unit test) — the grid
 * keeps every field the table declares, and carries no permissions
 * at all: nothing in the island reads them. A static build passes through that
 * funnel and is stamped as the anonymous visitor.
 */

import { narrowToBoundView, resolveBoundView } from './view-binding-inputs'
import type { TypeSpecificResolvedInputs } from './resolve-type-specific-inputs'
import type { CallerTableView } from '@/application/ports/services/page-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** The table as this grid's reader may see it, when the data-source pass stamped it. */
export function callerTableOf(component: Component): CallerTableView | undefined {
  const props = component.props as { readonly _callerTable?: CallerTableView } | undefined
  return props?._callerTable
}

/**
 * The fields the reader may read, in the table's declared order. A caller the
 * permissions route refuses (`permissionMap` absent) reads none.
 */
export function readableFieldsOf(
  table: Tables[number],
  callerTable: CallerTableView
): readonly string[] {
  const fields = callerTable.permissionMap?.fields ?? {}
  return table.fields.map((f) => f.name).filter((name) => fields[name]?.read === true)
}

/**
 * The fields a component's reader may read: for one reading through a view,
 * the view's columns as its route serves them to her
 * ({@link boundViewFieldsOf}) — the view's grant, not the table's — otherwise
 * those her permission map lets her read.
 */
export function readableFieldsForComponent(
  table: Tables[number],
  component: Component,
  callerTable: CallerTableView
): readonly string[] {
  if (resolveBoundView(component, table) === undefined) return readableFieldsOf(table, callerTable)
  return boundViewFieldsOf(table, callerTable) ?? table.fields.map((f) => f.name)
}

/**
 * The fields of `table` the reader `component` was stamped for may read, or
 * `undefined` (every field) without a stamp — for a list the server derives
 * from the table's declaration, such as a calendar's day-valued fields.
 */
export function readableFieldSetOf(
  table: Tables[number],
  component: Component
): ReadonlySet<string> | undefined {
  const callerTable = callerTableOf(component)
  return callerTable === undefined
    ? undefined
    : new Set(readableFieldsForComponent(table, component, callerTable))
}

/** The fields the reader may write — the records API's own write predicate. */
export function writableFieldsOf(callerTable: CallerTableView): readonly string[] {
  return Object.entries(callerTable.permissionMap?.fields ?? {})
    .filter(([, access]) => access.write)
    .map(([name]) => name)
}

/**
 * The grid's resolved inputs, narrowed to what `callerTable` lets its reader
 * see. Returns the inputs unchanged when there is no stamp.
 */
export function narrowToCaller(
  inputs: TypeSpecificResolvedInputs,
  table: Tables[number],
  callerTable: CallerTableView | undefined
): TypeSpecificResolvedInputs {
  if (callerTable === undefined) return inputs
  const readable = new Set(readableFieldsOf(table, callerTable))
  const writable = new Set(writableFieldsOf(callerTable))
  return {
    ...inputs,
    dataTableTableFields: inputs.dataTableTableFields?.filter((name) => readable.has(name)),
    dataTableFieldMeta:
      inputs.dataTableFieldMeta === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(inputs.dataTableFieldMeta)
              .filter(([name]) => readable.has(name))
              .map(([name, meta]) => [
                name,
                writable.has(name) ? meta : { ...(meta as object), readOnly: true },
              ])
          ),
    dataTablePermissions: callerTable.permissionMap,
  }
}

/**
 * The configured columns less every column on a declared field of `table` the
 * reader may not read — neither drawn nor named. A column on anything else (a
 * system column, a button) is kept. The same array back when nothing is
 * dropped, or without a stamp.
 */
export function readableColumnsOf<C>(
  columns: readonly C[] | undefined,
  table: Tables[number],
  callerTable: CallerTableView | undefined
): readonly C[] | undefined {
  if (columns === undefined || callerTable === undefined) return columns
  const readable = new Set(readableFieldsOf(table, callerTable))
  const declared = new Set(table.fields.map((f) => f.name))
  const kept = columns.filter((column) => {
    const { field } = column as { readonly field?: unknown }
    return typeof field !== 'string' || !declared.has(field) || readable.has(field)
  })
  return kept.length === columns.length ? columns : kept
}

/**
 * A synthesized field list (a drawer's entries, a form's inputs) as its reader
 * may see it: an entry on a field she may not read is left out, one on a field
 * she may not write is marked `readOnly` — drawn as its value, never sent.
 * Unchanged without a stamp.
 */
export function fieldEntriesForReader<E extends { readonly name: string }>(
  entries: readonly E[],
  table: Tables[number],
  callerTable: CallerTableView | undefined
): readonly (E | (E & { readonly readOnly: true }))[] {
  if (callerTable === undefined) return entries
  const readable = new Set(readableFieldsOf(table, callerTable))
  const writable = new Set(writableFieldsOf(callerTable))
  return entries
    .filter((entry) => readable.has(entry.name))
    .map((entry) => (writable.has(entry.name) ? entry : { ...entry, readOnly: true as const }))
}

/**
 * The fields a view-bound grid may name: the view's own `fields` as its route
 * masked them for the reader. A view that lists no fields names those her
 * permission map lets her read; `undefined` (no narrowing) without a stamp.
 * A view the route refuses her names none.
 */
export function boundViewFieldsOf(
  table: Tables[number],
  callerTable: CallerTableView | undefined
): readonly string[] | undefined {
  if (callerTable === undefined) return undefined
  const { boundView } = callerTable
  if (boundView === undefined) return []
  if (boundView.fields !== undefined && boundView.fields.length > 0) return boundView.fields
  return callerTable.permissionMap === undefined ? undefined : readableFieldsOf(table, callerTable)
}

/**
 * {@link narrowToCaller}, for the reader whose table view the grid was stamped
 * with. A grid reading through one of the table's views is told only that
 * view's columns, as the view's route serves them to her
 * ({@link boundViewFieldsOf}, `view-binding-inputs.ts`).
 */
export function forReader(
  inputs: TypeSpecificResolvedInputs,
  table: Tables[number],
  component: Component
): TypeSpecificResolvedInputs {
  const callerTable = callerTableOf(component)
  const view = resolveBoundView(component, table)
  if (view === undefined) return narrowToCaller(inputs, table, callerTable)
  return narrowToBoundView(inputs, view, boundViewFieldsOf(table, callerTable))
}

/**
 * The fields the reader may change on a STORED record: none when the table's
 * `update` refuses her, however her map answers each field's write (that
 * answer also serves a create), else the fields she may write.
 */
export function updatableFieldsOf(callerTable: CallerTableView): readonly string[] {
  return callerTable.permissionMap?.table.update === true ? writableFieldsOf(callerTable) : []
}

/**
 * The configured columns with no inline input on a field the reader may not
 * update: `editable: false` on each, whatever the column declared — the records
 * API would refuse the write the input offers. An inline edit updates a stored
 * record, so a reader the table's `update` refuses may update no field at all,
 * however her map answers each one's write. Unchanged without a stamp.
 */
export function withCallerWritableColumns<C>(
  columns: readonly C[] | undefined,
  callerTable: CallerTableView | undefined
): readonly C[] | undefined {
  if (columns === undefined || callerTable === undefined) return columns
  const writable = updatableFieldsOf(callerTable)
  return columns.map((column) => {
    const { field } = column as { readonly field?: unknown }
    return typeof field === 'string' && !writable.includes(field)
      ? { ...column, editable: false }
      : column
  })
}

/**
 * A grid declared `readOnly` is a reading for every reader: no column opens an
 * editor, whatever its own `editable` says. Presentation only — the records
 * API answers exactly as before.
 */
export function withoutInlineEditing<C>(
  columns: readonly C[] | undefined
): readonly C[] | undefined {
  return columns?.map((column) =>
    typeof (column as { readonly field?: unknown }).field === 'string'
      ? { ...column, editable: false }
      : column
  )
}

/** The binding each alternate view of a grid cannot be drawn without. */
const ALTERNATE_VIEW_AXES: ReadonlyArray<{
  readonly view: string
  readonly key: string
  readonly fieldOf: (value: unknown) => unknown
}> = [
  {
    view: 'kanban',
    key: 'kanbanGroupBy',
    fieldOf: (value) => (value as { readonly field?: unknown } | undefined)?.field,
  },
  { view: 'calendar', key: 'dateField', fieldOf: (value) => value },
]

/**
 * A grid's alternate views as its reader may be offered them: a view laid out
 * by a declared field she may not read — a board grouped by it, a calendar
 * placed by it — is not offered, and its binding is not carried, so the page
 * names neither the field nor its options. The same component back when
 * nothing is dropped, or without a stamp.
 */
export function alternateViewsForReader<C extends object>(
  component: C,
  table: Tables[number],
  callerTable: CallerTableView | undefined
): C {
  if (callerTable === undefined) return component
  const readable = new Set(readableFieldsOf(table, callerTable))
  const declared = new Set(table.fields.map((f) => f.name))
  const bag = component as Readonly<Record<string, unknown>>
  const hidden = ALTERNATE_VIEW_AXES.filter(({ key, fieldOf }) => {
    const field = fieldOf(bag[key])
    return typeof field === 'string' && declared.has(field) && !readable.has(field)
  })
  if (hidden.length === 0) return component
  const droppedViews = new Set(hidden.map(({ view }) => view))
  const droppedKeys = new Set(hidden.map(({ key }) => key))
  const views = Array.isArray(bag['views'])
    ? (bag['views'] as readonly unknown[]).filter((view) => !droppedViews.has(String(view)))
    : bag['views']
  const kept = Object.entries(bag).filter(([key]) => !droppedKeys.has(key))
  return { ...Object.fromEntries(kept), ...(views !== undefined && { views }) } as C
}
