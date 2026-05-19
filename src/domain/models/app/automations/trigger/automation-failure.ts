/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AutomationFailureTriggerSchema = Schema.Struct({
  type: Schema.Literal('automation-failure'),
  automations: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description: 'Automation name to watch for failures (kebab-case)',
        })
      )
    ).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description:
          'List of automation names to watch. If omitted, triggers on any automation failure.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AutomationFailureTrigger',
    title: 'Automation Failure Trigger',
    description:
      'Trigger an automation when another automation fails. Enables composable failure handling without per-automation notification config.',
  })
)

export type AutomationFailureTrigger = Schema.Schema.Type<typeof AutomationFailureTriggerSchema>
