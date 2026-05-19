/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

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
