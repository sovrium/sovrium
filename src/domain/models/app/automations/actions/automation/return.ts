/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Automation Return Action (type: automation, operator: return)
 *
 * Sends output data back to a calling automation when a sub-workflow
 * completes. The returned data becomes available in the parent
 * automation as `{{steps.{callStepName}.result.*}}`.
 *
 * This action only works in automations with an `automation-call` trigger.
 * Using it with other trigger types produces a validation warning.
 */
export const AutomationReturnActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('automation'),
  operator: Schema.Literal('return'),
  props: Schema.Struct({
    /** Key-value data to return to the calling automation */
    data: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description:
          'Key-value pairs returned to the calling automation (supports template variables). Accessible as steps.{name}.result.* in the parent.',
      })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AutomationReturnAction',
    title: 'Automation Return Action',
    description:
      'Send output data back to a calling automation. Only effective with automation-call trigger.',
  })
)

/** @public */
export type AutomationReturnAction = Schema.Schema.Type<typeof AutomationReturnActionSchema>
