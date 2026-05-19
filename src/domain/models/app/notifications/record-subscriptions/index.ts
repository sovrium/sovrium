/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DefaultSubscribersSchema } from './default-subscribers'

export { DefaultSubscribersSchema } from './default-subscribers'


export const RecordSubscriptionSchema = Schema.Struct({
  table: Schema.String.pipe(
    Schema.annotations({ description: 'Table name to watch for record changes' })
  ),

  events: Schema.Array(Schema.Literal('created', 'updated', 'deleted')).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Subscription Events',
      description: 'Record events that trigger notifications',
    })
  ),

  fields: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Field names to watch (all fields if omitted)' })
    )
  ),

  defaultSubscribers: Schema.optional(DefaultSubscribersSchema),
}).pipe(
  Schema.annotations({
    identifier: 'RecordSubscription',
    title: 'Record Change Subscription',
    description: 'Subscribe to record CRUD events on a table for automatic notification delivery.',
  })
)
