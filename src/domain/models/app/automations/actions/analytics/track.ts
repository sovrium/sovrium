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
 * Analytics Action (type: analytics, operator: track)
 *
 * Track custom events and metrics in the built-in analytics system.
 */
export const AnalyticsTrackActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('analytics').pipe(
    Schema.annotate({
      description: "Constant value 'analytics' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('track').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'analytics' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    event: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Custom event name to track (non-empty)' }),
      Schema.check(Schema.isMinLength(1))
    ),
    properties: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({ description: 'Event properties (key-value pairs)' })
      )
    ),
  }).annotate({
    description: 'The event to record and the properties kept with it.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AnalyticsTrackAction',
    title: 'Analytics Track Action',
    description: 'Track custom events in the built-in analytics system',
  })
)

/** @public */
export type AnalyticsTrackAction = Schema.Schema.Type<typeof AnalyticsTrackActionSchema>
