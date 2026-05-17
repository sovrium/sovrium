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
 * Webhook Send Action (type: webhook, operator: send)
 *
 * Send outgoing webhooks. Two shapes are supported:
 *
 *   1. Envelope mode — provide `event` (and optional `data`); the runtime
 *      builds a `{ event, data }` payload and POSTs it to `url`.
 *   2. Pass-through mode — provide `method`, optional `headers`, and `body`;
 *      the runtime sends those verbatim. Used when the destination already
 *      expects a specific shape (e.g. Slack incoming webhook, GitHub-style
 *      hook receivers).
 *
 * Both modes support `secret` (HMAC-SHA256 signature header) and `connection`
 * (auth-header injection from `app.connections[]`).
 *
 * Cross-validation (REC-C3-3): a config that provides ONLY `url` (neither
 * `event` nor any of `method`/`body`/`headers`) has no semantic — the runtime
 * would dispatch a no-body POST against the destination. The schema rejects
 * that empty-mode shape at decode time so misconfiguration surfaces during
 * `bun run sovrium validate` rather than at automation-trigger time.
 */
export const WebhookSendActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('webhook'),
  operator: Schema.Literal('send'),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(Schema.annotations({ description: 'Webhook destination URL' })),
    event: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Event name for the webhook payload envelope' })
      )
    ),
    method: Schema.optional(
      Schema.Literal('GET', 'POST', 'PUT', 'PATCH', 'DELETE').pipe(
        Schema.annotations({ description: 'HTTP method (default: POST)' })
      )
    ),
    headers: Schema.optional(
      Schema.Record({ key: Schema.String, value: TemplateStringSchema }).pipe(
        Schema.annotations({
          description: 'Request headers (values support template variables and $env)',
        })
      )
    ),
    body: Schema.optional(
      Schema.Union(
        Schema.String,
        Schema.Record({ key: Schema.String, value: Schema.Unknown })
      ).pipe(Schema.annotations({ description: 'Request body — string or JSON object' }))
    ),
    data: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({ description: 'Webhook payload data (envelope mode)' })
      )
    ),
    secret: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Secret for X-Webhook-Signature HMAC header (e.g., $env.WEBHOOK_SECRET)',
        })
      )
    ),
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description:
            'Connection name for authentication (must reference app.connections[]). Auth headers are auto-injected.',
        })
      )
    ),
  }),
}).pipe(
  Schema.filter((action) => {
    // REC-C3-3: enforce envelope-XOR-pass-through. A `url`-only config has no
    // semantic — the runtime would POST an empty body to the destination,
    // which is almost certainly a misconfiguration. We require at least one
    // of `event` (envelope mode) or `method`/`body`/`headers` (pass-through
    // mode) so the misconfiguration surfaces at validate time rather than
    // at automation-trigger time.
    const { props } = action
    const hasEnvelopeSignal = props.event !== undefined
    const hasPassThroughSignal =
      props.method !== undefined || props.body !== undefined || props.headers !== undefined
    if (!hasEnvelopeSignal && !hasPassThroughSignal) {
      return 'webhook/send requires either an `event` (envelope mode) or one of `method`/`body`/`headers` (pass-through mode); a `url`-only config has no payload to send'
    }
    return undefined
  }),
  Schema.annotations({
    identifier: 'WebhookSendAction',
    title: 'Webhook Send Action',
    description: 'Send outgoing webhook (envelope or pass-through mode)',
  })
)
