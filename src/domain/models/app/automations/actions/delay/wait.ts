/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DelayWaitActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay'),
  operator: Schema.Literal('wait'),
  props: Schema.Struct({
    duration: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^\d+\s*(ms|s|m|h|d)$/),
        Schema.annotations({
          description:
            'Delay duration: number + unit (ms, s, m, h, d). Examples: "30s", "5m", "24h", "7d"',
        })
      )
    ),

    until: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'ISO 8601 datetime or template variable to wait until. Example: "2025-12-01T09:00:00Z"',
        })
      )
    ),
  }).pipe(
    Schema.filter((props) => {
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
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DelayWaitAction',
    title: 'Delay Wait Action',
    description: 'Pause automation execution for a fixed duration or until a specific datetime',
  })
)

export type DelayWaitAction = Schema.Schema.Type<typeof DelayWaitActionSchema>
