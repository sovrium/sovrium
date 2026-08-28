/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard table Data-tab surface ([internal ref] dogfood).
 *
 * The Data tab is an Airtable-grade record grid over the operator's record
 * CRUD API — and it is now the GENERIC `data-table` component bound to the
 * operator table by its DB-table data source (`dataSource.table`), NOT a bespoke
 * `admin-record-grid` island. The data-table's DB-table mode already ships the
 * full record-grid feature set the surface needs: `role="grid"` semantics (via
 * `aria-label`), per-cell inline edit, a typed "Nouvel enregistrement" create
 * modal (one control per writable field, derived from the table's field schema
 * + render-time `_canCreate` gate), server-side search/sort/filter, and a
 * row-click that fires the existing `onRowClick: openDrawer` action.
 *
 * Clicking a row opens a record-detail `record-drawer` (the
 * [internal ref] specialization): a schema-derived
 * form — one control per table field, fetched via `GET …/records/:id` — that
 * PATCHes the record via `PATCH …/records/:id`. The grid + the drawer are
 * composed from EXISTING component-types (`data-table` + `data-table.onRowClick:
 * openDrawer` + `record-drawer`); the record form is DERIVED from the table's
 * field schema at render time, so one surface serves every table — no bespoke
 * island, no new backend.
 */

import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

/** A field of the operator table the drawer form derives a control from. */
export interface TableField {
  readonly name: string
  readonly type: string
  /** Declared choices for a `single-select` field (drives the create dropdown). */
  readonly options?: ReadonlyArray<string>
  /** Whether the column is required (the create control gets `required`). */
  readonly required?: boolean
}

/** The operator table this surface administers (its fields drive the form). */
type OperatorTable = App['tables'] extends ReadonlyArray<infer T> | undefined ? T : never

/** Drawer component id referenced by the grid's `onRowClick: openDrawer`. */
const RECORD_DRAWER_ID = 'record-detail-drawer'

/** Read a field's declared `options` array, keeping only string choices. */
function readOptions(raw: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(raw)) return undefined
  const choices = raw.filter((opt): opt is string => typeof opt === 'string')
  return choices.length > 0 ? choices : undefined
}

/** Extract `{ name, type, options? }` field descriptors from the operator table. */
export function extractFields(table: OperatorTable | undefined): ReadonlyArray<TableField> {
  const fields = (table as { readonly fields?: ReadonlyArray<unknown> } | undefined)?.fields ?? []
  return fields.flatMap((field): ReadonlyArray<TableField> => {
    const f = field as {
      readonly name?: unknown
      readonly type?: unknown
      readonly options?: unknown
      readonly required?: unknown
    }
    if (typeof f.name !== 'string' || typeof f.type !== 'string') return []
    const options = readOptions(f.options)
    return [
      {
        name: f.name,
        type: f.type,
        ...(options ? { options } : {}),
        ...(f.required === true ? { required: true } : {}),
      },
    ]
  })
}

/**
 * The Airtable-grade record grid as the GENERIC `data-table` component, bound to
 * the operator table by its DB-table data source.
 *
 * The DB-table binding (`dataSource.table`) unlocks the data-table's full record
 * CRUD feature set: the runtime renders a `role="grid"` table named
 * `Records {table}` (via the `aria-label`), with a `role="gridcell"` per
 * field value, inline-edit on double-click, server-side search, and the
 * "Nouvel enregistrement" create modal (a TYPED control per writable field,
 * gated by the render-time `_canCreate` permission). A single click on a row
 * fires `onRowClick: openDrawer` → dispatches `sovrium:open-drawer` to the
 * sibling {@link RECORD_DRAWER_ID} drawer so its schema-derived detail form
 * opens for the clicked record.
 *
 * Columns are passed explicitly (one per declared field, `label` = field name)
 * so the header order matches the table's declared field order; the create form
 * and inline-edit derive their own field set + types from the bound table at
 * render time.
 */
export function recordGridDataTable(
  tableName: string,
  fields: ReadonlyArray<TableField>
): Component {
  return {
    type: 'data-table',
    props: {
      // Rendered as `aria-label` on the `role="grid"` table so the specs'
      // `getByRole('grid', { name: 'Records {table}' })` resolves.
      'aria-label': `Records ${tableName}`,
    },
    dataSource: { table: tableName },
    columns: fields.map((field) => ({ field: field.name, label: field.name })),
    // The record search box (a `searchbox` role) — the Airtable-grade affordance
    // the bespoke grid had. The toolbar renders it only when the `search` config
    // is present (not merely `toolbar.search`), so the ComponentSearchSchema is
    // set here.
    search: { enabled: true, placeholder: 'Search rows' },
    // Without this the no-match state falls back to the generic empty message —
    // a search that matches nothing reads as "this table is empty", which is a
    // different and alarming claim. Every sibling grid (runs, submissions,
    // files, links, connections, users) already distinguishes the two.
    noMatchMessage: 'No record matches “{query}”',
    // Saved views + row density — pure CONFIG. The tables (`user_saved_views` /
    // `user_table_preferences`), their CRUD, and every island primitive
    // (view-switcher, views-menu, save-view-dialog, density-menu,
    // settings-dialog) already ship; this grid simply declared no toolbar, so
    // the gates at `toolbar.tsx:474` (`viewsEnabled`) and `:569` (density) never
    // opened.
    //
    // Scoped deliberately to THIS grid. `viewsEnabled` is
    // `!isSystemSource && toolbarConfig?.views === true`
    // (`use-island-setup.ts:590`), and every OTHER admin grid binds
    // `dataSource.system`, so views are hard-off there by construction. Density
    // is gated only on the flag, but it persists through
    // `useTablePreferences(tableKey)` and `tableKey` is the EMPTY STRING for a
    // system source — so declaring density on a system grid would paint a
    // control that silently cannot persist. This grid binds `dataSource.table`,
    // so both have a real table key behind them.
    //
    // `columnToggle` is deliberately NOT declared: it is a schema flag with zero
    // consumers in `src/presentation/`, so it would render nothing.
    // `viewSwitcher` is withheld too — it paints one button per view TYPE, and
    // kanban/calendar view types do not exist here.
    toolbar: { views: true, density: true },
    // The grid ALREADY caps at 25 rows: absent a `pagination` block the island
    // falls back to a page size of 25 and sends it as `?limit=`. What was
    // missing was the pager, which renders only when the block is present — so
    // a 28-row table painted 25 rows, said nothing, and left three records
    // reachable by search but not by browsing. A grid may cap; it may not cap
    // silently. The summary this turns on ("1–25 of 28") is also the count the
    // sibling runs and submissions grids state in copy.
    pagination: { pageSize: 25, pageSizeOptions: [25, 50, 100] },
    // A row click opens the sibling record-detail drawer (reuses the existing
    // openDrawer action — no bespoke row-click island).
    onRowClick: { action: 'openDrawer', component: RECORD_DRAWER_ID },
    emptyMessage: 'No records',
  } as unknown as Component
}
