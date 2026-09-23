/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Delay Action (type: delay, operator: wait)
 *
 * Pause automation execution for a fixed duration or until a specific datetime.
 * Exactly one of `duration` or `until` must be provided.
 *
 * Duration format: number + unit (ms, s, m, h, d)
 * Examples: "30s", "5m", "24h", "7d"
 *
 * Until format: ISO 8601 datetime or template variable
 * Examples: "2025-12-01T09:00:00Z", "{{calculateResumeTime.result}}"
 */
export const DelayWaitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay').pipe(
    Schema.annotate({
      description: "Constant value 'delay' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('wait').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'delay' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Fixed delay duration (e.g., "30s", "5m", "24h", "7d") */
    duration: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Delay duration: number + unit (ms, s, m, h, d). Examples: "30s", "5m", "24h", "7d"',
        }),
        Schema.check(Schema.isPattern(/^\d+\s*(ms|s|m|h|d)$/))
      )
    ),

    /** Wait until a specific datetime (ISO 8601 or template variable) */
    until: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'ISO 8601 datetime or template variable to wait until. Example: "2025-12-01T09:00:00Z"',
        })
      )
    ),
  })
    .annotate({
      description: 'How long to pause for, or the moment to resume at.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => {
          const hasDuration = props.duration !== undefined
          const hasUntil = props.until !== undefined
          if (hasDuration && hasUntil) {
            return 'Provide either "duration" or "until", not both'
          }
          if (!hasDuration && !hasUntil) {
            return 'One of "duration" or "until" is required'
          }
          return true
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'DelayWaitAction',
    title: 'Delay Wait Action',
    description: 'Pause automation execution for a fixed duration or until a specific datetime',
  })
)

/** @public */
export type DelayWaitAction = Schema.Schema.Type<typeof DelayWaitActionSchema>
