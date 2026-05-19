/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { WebhookResponseActionSchema } from './response'
import { WebhookSendActionSchema } from './send'

export const WebhookActionSchema = Schema.Union(
  WebhookSendActionSchema,
  WebhookResponseActionSchema
).pipe(
  Schema.annotations({
    identifier: 'WebhookAction',
    title: 'Webhook Action',
    description: 'Outgoing webhook send or synchronous response construction',
  })
)

export type WebhookAction = Schema.Schema.Type<typeof WebhookActionSchema>

export * from './response'
export * from './send'
