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
 * Webhook Response Action (type: webhook, operator: response)
 *
 * Construct a custom response for synchronous webhook triggers.
 * Only valid in automations with webhook trigger + respondImmediately: false.
 */
export const WebhookResponseActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('webhook'),
  operator: Schema.Literal('response'),
  props: Schema.Struct({
    status: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 })),
        Schema.annotate({ description: 'HTTP response status code (default: 200)' })
      )
    ),
    body: Schema.optional(
      Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
        Schema.annotate({ description: 'Response body — string or JSON object' })
      )
    ),
    headers: Schema.optional(
      Schema.Record(Schema.String, TemplateStringSchema).pipe(
        Schema.annotate({ description: 'Response headers' })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookResponseAction',
    title: 'Webhook Response Action',
    description:
      'Construct a custom response for synchronous webhook triggers (respondImmediately: false)',
  })
)
