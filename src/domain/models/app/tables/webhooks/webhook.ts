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

// ─── Webhook Schema ─────────────────────────────────────────────────────────

/**
 * Table webhook configuration — fires outgoing HTTP requests on record CRUD events.
 *
 * Table webhooks are syntactic sugar over automations. Sovrium expands each
 * webhook into an equivalent automation with a record trigger and webhook.send action.
 *
 * @example
 * ```typescript
 * {
 *   name: 'notify-fulfillment',
 *   url: 'https://fulfillment.example.com/webhooks/orders',
 *   events: ['create', 'update'],
 *   enabled: true,
 *   auth: { type: 'hmac', secret: '$env.PARTNER_SECRET', algorithm: 'sha256' },
 *   retry: { maxAttempts: 5, backoff: 'exponential' },
 *   payload: { includeFields: ['customer', 'status'], includePreviousValues: true },
 * }
 * ```
 */
export const WebhookSchema = Schema.Struct({
  /** Unique webhook name within the table. */
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: 'Webhook Name',
      description: 'Unique webhook identifier within the table',
    })
  ),

  /** Destination URL for the outgoing HTTP POST request. */
  url: Schema.String.pipe(
    Schema.annotations({
      title: 'Webhook URL',
      description: 'Destination URL for outgoing webhook POST requests',
    })
  ),

  /** Record events that trigger this webhook. At least one required. */
  events: Schema.Array(Schema.Literal('create', 'update', 'delete')).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Webhook Events',
      description: 'Record CRUD events that trigger webhook delivery',
    })
  ),

  /** Whether this webhook is active (default: true). */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether this webhook is active (default: true)' })
    )
  ),

  /** Authentication for outgoing requests (optional). */
  auth: Schema.optional(WebhookAuthSchema),

  /** Retry policy for failed deliveries (optional, defaults: 3 attempts, exponential backoff). */
  retry: Schema.optional(WebhookRetrySchema),

  /** Payload field selection and metadata options (optional). */
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

/** @public */
export type Webhook = Schema.Schema.Type<typeof WebhookSchema>
/** @public */
export type WebhookEncoded = Schema.Schema.Encoded<typeof WebhookSchema>
