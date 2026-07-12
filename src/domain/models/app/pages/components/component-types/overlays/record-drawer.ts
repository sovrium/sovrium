/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Schema } from 'effect'
import { ActionSchema } from '../../action'
import { ConfirmGateSchema } from '../../confirm-gate'
import { ButtonVariantSchema } from '../../shared-schemas'
import { SystemDetailSourceSchema } from '../../system-detail-source'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const RecordDrawerTypeLiteral = Schema.Literal('record-drawer')

export const RecordDrawerFieldRenderAsSchema = Schema.Literal(
  'text',
  'json',
  'list',
  'key-value',
  'code'
).annotations({
  title: 'Record Drawer Field Render As',
  description:
    'How a record-drawer field renders its value: text (default, String(value)), json (pretty <pre>), list (array-of-objects as a labelled list), key-value (nested object as a definition list), code (raw string in a monospace block).',
})

export const RecordDrawerFieldSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  renderAs: Schema.optional(RecordDrawerFieldRenderAsSchema),
}).pipe(Schema.annotations({ identifier: 'RecordDrawerField', title: 'Record Drawer Field' }))

export const RecordDrawerActionSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: "Footer action button text (and the confirm dialog's confirm-button label).",
  }),
  action: ActionSchema,
  variant: Schema.optional(ButtonVariantSchema),
  confirm: Schema.optional(ConfirmGateSchema),
}).pipe(Schema.annotations({ identifier: 'RecordDrawerAction', title: 'Record Drawer Action' }))

export const RecordDrawerRoleSchema = Schema.Literal('dialog', 'region').annotations({
  title: 'Record Drawer Role',
  description:
    'Accessible role of the drawer surface: dialog (default) or region. Its accessible name comes from props.title.',
})

export const recordDrawerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  id: Schema.optional(
    Schema.String.annotations({
      description:
        "Record-drawer identifier referenced by `onRowClick: { action: 'openDrawer', component }`.",
    })
  ),
  dataSource: Schema.optional(
    Schema.Union(
      Schema.Struct({ table: Schema.String }).pipe(
        Schema.annotations({ identifier: 'RecordDrawerDataSource' })
      ),
      Schema.Struct({
        system: SystemDetailSourceSchema,
      }).annotations({
        title: 'Record Drawer System Detail Source',
        description: 'System detail-endpoint binding for the record-detail drawer',
      })
    ).annotations({
      identifier: 'RecordDrawerDataSourceBinding',
      title: 'Record Drawer Data Source',
      description: 'DB-table single-record binding OR a system detail-endpoint binding',
    })
  ),
  recordFields: Schema.optional(Schema.Array(RecordDrawerFieldSchema)),
  canEdit: Schema.optional(Schema.Boolean),
  actions: Schema.optional(
    Schema.Array(RecordDrawerActionSchema).annotations({
      title: 'Record Drawer Actions',
      description:
        "Footer action buttons rendered below the record body. Each fires against the drawer's loaded record ($record.* resolved at click time) and reuses the button action + confirm dispatch.",
    })
  ),
  role: Schema.optional(RecordDrawerRoleSchema),
} as const
