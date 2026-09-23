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
    Schema.annotate({
      title: 'Webhook Name',
      description: 'Unique webhook identifier within the table',
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Destination URL for the outgoing HTTP POST request. */
  url: Schema.String.annotate({
    description: 'Address the record event is POSTed to. It has to be an `http` or `https` URL.',
  }).pipe(
    Schema.check(
      Schema.makeFilter(
        (value) => {
          // Reject malformed URLs at schema-decode time. The webhook dispatcher
          // only ever issues http(s) POST requests, so anything that does not
          // parse as an absolute http/https URL is a configuration error.
          try {
            const parsed = new URL(value)
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          } catch {
            return false
          }
        },
        { message: 'Webhook url must be a valid http(s) URL' }
      )
    ),
    Schema.annotate({
      title: 'Webhook URL',
      description: 'Destination URL for outgoing webhook POST requests',
    })
  ),

  /** Record events that trigger this webhook. At least one required. */
  events: Schema.Array(Schema.Literals(['create', 'update', 'delete'])).pipe(
    Schema.annotate({
      title: 'Webhook Events',
      description: 'Record CRUD events that trigger webhook delivery',
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Whether this webhook is active (default: true). */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Whether this webhook is active (default: true)' })
    )
  ),

  /** Authentication for outgoing requests (optional). */
  auth: Schema.optional(WebhookAuthSchema),

  /** Retry policy for failed deliveries (optional, defaults: 3 attempts, exponential backoff). */
  retry: Schema.optional(WebhookRetrySchema),

  /** Payload field selection and metadata options (optional). */
  payload: Schema.optional(WebhookPayloadSchema),
}).pipe(
  Schema.annotate({
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
export type WebhookEncoded = Schema.Codec.Encoded<typeof WebhookSchema>
