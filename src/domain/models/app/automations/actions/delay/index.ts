/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DelayQueueActionSchema } from './queue'
import { DelayWaitActionSchema } from './wait'
import { DelayWebhookActionSchema } from './webhook'

export const DelayActionSchema = Schema.Union(
  DelayWaitActionSchema,
  DelayWebhookActionSchema,
  DelayQueueActionSchema
).pipe(
  Schema.annotations({
    identifier: 'DelayAction',
    title: 'Delay Action',
    description: 'Pause execution: wait for duration/datetime, webhook callback, or queue throttle',
  })
)

export type DelayAction = Schema.Schema.Type<typeof DelayActionSchema>

export * from './queue'
export * from './wait'
export * from './webhook'
