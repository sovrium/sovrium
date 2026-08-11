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
  type: Schema.Literal('analytics'),
  operator: Schema.Literal('track'),
  props: Schema.Struct({
    event: TemplateStringSchema.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Custom event name to track (non-empty)' })
    ),
    properties: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({ description: 'Event properties (key-value pairs)' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AnalyticsTrackAction',
    title: 'Analytics Track Action',
    description: 'Track custom events in the built-in analytics system',
  })
)

/** @public */
export type AnalyticsTrackAction = Schema.Schema.Type<typeof AnalyticsTrackActionSchema>
