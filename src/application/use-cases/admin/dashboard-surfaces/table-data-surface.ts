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
    search: { enabled: true, placeholder: 'Search rows…' },
    // A row click opens the sibling record-detail drawer (reuses the existing
    // openDrawer action — no bespoke row-click island).
    onRowClick: { action: 'openDrawer', component: RECORD_DRAWER_ID },
    emptyMessage: 'No records',
  } as unknown as Component
}
