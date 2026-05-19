/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const WebhookAuthSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('hmac'),
    secret: Schema.String.pipe(
      Schema.annotations({ description: 'HMAC secret for signing (supports $env. references)' })
    ),
    algorithm: Schema.optional(
      Schema.Literal('sha256', 'sha1').pipe(
        Schema.annotations({ description: 'HMAC hash algorithm' })
      )
    ),
    header: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Header name for the HMAC signature' }))
    ),
  }),
  Schema.Struct({
    type: Schema.Literal('apiKey'),
    key: Schema.String.pipe(
      Schema.annotations({ description: 'API key value (supports $env. references)' })
    ),
    header: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Header name for the API key' }))
    ),
  }),
  Schema.Struct({
    type: Schema.Literal('bearer'),
    token: Schema.String.pipe(
      Schema.annotations({ description: 'Bearer token (supports $env. references)' })
    ),
  })
).pipe(
  Schema.annotations({
    identifier: 'WebhookAuth',
    title: 'Webhook Authentication',
    description: 'Authentication for outgoing webhook requests (HMAC, API key, or bearer token).',
  })
)
