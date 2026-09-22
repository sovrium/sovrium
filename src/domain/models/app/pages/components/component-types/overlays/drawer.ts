/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DrawerSideSchema, DrawerSizeSchema } from '../../form-controls'
import { SystemDetailSourceSchema } from '../../system-detail-source'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'
import {
  RecordDrawerActionSchema,
  RecordDrawerFieldSchema,
  RecordDrawerRoleSchema,
} from './record-drawer'

export const DrawerTypeLiteral = Schema.Literal('drawer')

export const drawerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Component identifier — referenced by an `onRowClick.action: 'openDrawer'`
   * dispatch (PG-04 quick-edit drawer pattern). Authors set `id` at the
   * top level (sibling of `type` / `props`) so the cross-component reference
   * reads naturally:
   *
   *   { type: 'table', onRowClick: { action: 'openDrawer', component: 'record-detail' } }
   *   { type: 'drawer', id: 'record-detail', children: [...] }
   *
   * The render-time `resolveOpenDrawerDispatches` pass tags any drawer
   * referenced this way so the hydrated island defaults to `open=false`.
   */
  id: Schema.optional(
    Schema.String.annotate({
      description:
        "Drawer identifier referenced by `onRowClick: { action: 'openDrawer', component: <id> }` (PG-04).",
    })
  ),
  drawerSide: Schema.optional(DrawerSideSchema),
  drawerSize: Schema.optional(DrawerSizeSchema),
  /**
   * The single-record source the drawer fetches (and, for a DB table, patches).
   *
   * Discriminated:
   *  - `{ table }` — the original DB-table binding: fetch `GET …/records/:id`,
   *    save `PATCH …/records/:id` (UNCHANGED — every existing config keeps working).
   *  - `{ system }` — a system DETAIL-endpoint binding (`SystemDetailSourceSchema`):
   *    the drill-down opened from a system-source `table` fetches the clicked
   *    row's detail from a read endpoint (e.g. an automation run detail at
   *    `/api/admin/automations/runs/:runId`) instead of `/api/tables/:t/records/:id`.
   *    A system-detail drawer is READ-ONLY (no records table to PATCH).
   */
  dataSource: Schema.optional(
    Schema.Union([
      Schema.Struct({ table: Schema.String }).pipe(
        Schema.annotate({ identifier: 'RecordDrawerDataSource' })
      ),
      Schema.Struct({
        /** System detail-endpoint binding (mutually exclusive with the DB-table form) */
        system: SystemDetailSourceSchema,
      }).annotate({
        title: 'Record Drawer System Detail Source',
        description: 'System detail-endpoint binding for the record-detail drawer',
      }),
    ]).annotate({
      identifier: 'RecordDrawerDataSourceBinding',
      title: 'Record Drawer Data Source',
      description: 'DB-table single-record binding OR a system detail-endpoint binding',
    })
  ),
  /** Schema-derived field list (one control per field), authored at render time. */
  recordFields: Schema.optional(Schema.Array(RecordDrawerFieldSchema)),
  /** F6 tier read/edit split: `false` renders a read-only record (no save). */
  canEdit: Schema.optional(Schema.Boolean),
  /**
   * Footer action slot (CAP-1). One or more button-shaped actions rendered
   * below the record body. Each fires against the drawer's LOADED record
   * (`$record.*` resolved at click time) and reuses the standalone-button
   * `action` + `confirm` dispatch. Additive — a drawer without `actions` renders
   * exactly as before.
   */
  actions: Schema.optional(
    Schema.Array(RecordDrawerActionSchema).annotate({
      title: 'Record Drawer Actions',
      description:
        "Footer action buttons rendered below the record body. Each fires against the drawer's loaded record ($record.* resolved at click time) and reuses the button action + confirm dispatch.",
    })
  ),
  /**
   * Accessible role of the drawer surface (CAP-2). `dialog` (default) | `region`.
   * The accessible NAME is read from `props.title`. Additive — omit it (and/or
   * `props.title`) to keep the default `dialog "Détail de l'enregistrement"`.
   */
  role: Schema.optional(RecordDrawerRoleSchema),
} as const
