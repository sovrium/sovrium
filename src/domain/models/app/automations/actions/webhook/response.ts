/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const WebhookResponseActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('webhook'),
  operator: Schema.Literal('response'),
  props: Schema.Struct({
    status: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(100, 599),
        Schema.annotations({ description: 'HTTP response status code (default: 200)' })
      )
    ),
    body: Schema.optional(
      Schema.Union(
        Schema.String,
        Schema.Record({ key: Schema.String, value: Schema.Unknown })
      ).pipe(Schema.annotations({ description: 'Response body — string or JSON object' }))
    ),
    headers: Schema.optional(
      Schema.Record({ key: Schema.String, value: TemplateStringSchema }).pipe(
        Schema.annotations({ description: 'Response headers' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookResponseAction',
    title: 'Webhook Response Action',
    description:
      'Construct a custom response for synchronous webhook triggers (respondImmediately: false)',
  })
)
