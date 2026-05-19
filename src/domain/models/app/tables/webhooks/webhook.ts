/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { WebhookAuthSchema } from './auth'
import { WebhookPayloadSchema } from './payload'
import { WebhookRetrySchema } from './retry'


export const WebhookSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: 'Webhook Name',
      description: 'Unique webhook identifier within the table',
    })
  ),

  url: Schema.String.pipe(
    Schema.annotations({
      title: 'Webhook URL',
      description: 'Destination URL for outgoing webhook POST requests',
    })
  ),

  events: Schema.Array(Schema.Literal('create', 'update', 'delete')).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Webhook Events',
      description: 'Record CRUD events that trigger webhook delivery',
    })
  ),

  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether this webhook is active (default: true)' })
    )
  ),

  auth: Schema.optional(WebhookAuthSchema),

  retry: Schema.optional(WebhookRetrySchema),

  payload: Schema.optional(WebhookPayloadSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Webhook',
    title: 'Table Webhook',
    description:
      'Outgoing HTTP webhook fired on table record CRUD events. Syntactic sugar over automations.',
    examples: [
      {
        name: 'notify-fulfillment',
        url: 'https://fulfillment.example.com/webhooks/orders',
        events: ['create' as const, 'update' as const],
      },
      {
        name: 'audit-deletions',
        url: 'https://audit.example.com/hooks/orders',
        events: ['delete' as const],
        enabled: false,
        auth: { type: 'hmac' as const, secret: '$env.AUDIT_SECRET' },
      },
    ],
  })
)

export type Webhook = Schema.Schema.Type<typeof WebhookSchema>
export type WebhookEncoded = Schema.Schema.Encoded<typeof WebhookSchema>
