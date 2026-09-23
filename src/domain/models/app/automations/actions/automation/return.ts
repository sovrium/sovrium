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
  type: Schema.Literal('automation').pipe(
    Schema.annotate({
      description: "Constant value 'automation' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('return').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'automation' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Key-value data to return to the calling automation */
    data: Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
        description:
          'Key-value pairs returned to the calling automation (supports template variables). Accessible as steps.{name}.result.* in the parent.',
      })
    ),
  }).annotate({
    description: 'The data handed back to the automation that called this one.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AutomationReturnAction',
    title: 'Automation Return Action',
    description:
      'Send output data back to a calling automation. Only effective with automation-call trigger.',
  })
)

/** @public */
export type AutomationReturnAction = Schema.Schema.Type<typeof AutomationReturnActionSchema>
