/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AutomationCallTriggerSchema = Schema.Struct({
  type: Schema.Literal('automation-call'),
  inputSchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description:
          'Expected input data contract (JSON Schema-like). If omitted, accepts any inputData from the caller.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AutomationCallTrigger',
    title: 'Automation Call Trigger',
    description:
      'Trigger that fires when another automation invokes this one via the automation/call action. Enables sub-workflow composition.',
  })
)

export type AutomationCallTrigger = Schema.Schema.Type<typeof AutomationCallTriggerSchema>
