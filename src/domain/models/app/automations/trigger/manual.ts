/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ManualTriggerSchema = Schema.Struct({
  type: Schema.Literal('manual'),

  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Button label in admin interface (e.g., "Export Report", "Sync Data")',
      })
    )
  ),

  inputSchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description: 'JSON Schema describing required input fields when manually triggered',
      })
    )
  ),

  requiredRole: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Auth role required to trigger this automation (default: admin)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ManualTrigger',
    title: 'Manual Trigger',
    description: 'Admin-initiated workflow execution via button or API call',
  })
)

export type ManualTrigger = Schema.Schema.Type<typeof ManualTriggerSchema>
