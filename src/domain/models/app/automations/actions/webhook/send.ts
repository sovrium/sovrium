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
 * Cross-validation: a config that provides ONLY `url` (neither
 * `event` nor any of `method`/`body`/`headers`) has no semantic — the runtime
 * would dispatch a no-body POST against the destination. The schema rejects
 * that empty-mode shape at decode time so misconfiguration surfaces during
 * `bun run sovrium validate` rather than at automation-trigger time.
 */
export const WebhookSendActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('webhook').pipe(
    Schema.annotate({
      description: "Constant value 'webhook' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('send').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'webhook' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    url: TemplateStringSchema.pipe(Schema.annotate({ description: 'Webhook destination URL' })),
    event: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Event name for the webhook payload envelope' })
      )
    ),
    method: Schema.optional(
      Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).pipe(
        Schema.annotate({ description: 'HTTP method (default: POST)' })
      )
    ),
    headers: Schema.optional(
      Schema.Record(Schema.String, TemplateStringSchema).pipe(
        Schema.annotate({
          description: 'Request headers (values support template variables and $env)',
        })
      )
    ),
    body: Schema.optional(
      Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
        Schema.annotate({ description: 'Request body — string or JSON object' })
      )
    ),
    data: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({ description: 'Webhook payload data (envelope mode)' })
      )
    ),
    secret: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Secret for X-Webhook-Signature HMAC header (e.g., $env.WEBHOOK_SECRET)',
        })
      )
    ),
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Connection name for authentication (must reference app.connections[]). Auth headers are auto-injected.',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
      )
    ),
  }).annotate({
    description: 'The webhook to send: its address, method, headers, payload and signing secret.',
  }),
}).pipe(
  Schema.check(
    Schema.makeFilter((action) => {
      // [internal ref]: enforce envelope-XOR-pass-through. A `url`-only config has no
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
    })
  ),
  Schema.annotate({
    identifier: 'WebhookSendAction',
    title: 'Webhook Send Action',
    description: 'Send outgoing webhook (envelope or pass-through mode)',
  })
)
