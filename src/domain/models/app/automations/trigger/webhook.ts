/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../template'

const WebhookAuthSchema = Schema.Struct({
  type: Schema.Literal('bearer', 'apiKey', 'hmac', 'basic').pipe(
    Schema.annotations({ description: 'Authentication mechanism for incoming webhooks' })
  ),

  token: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Bearer token or API key value (e.g., $env.WEBHOOK_TOKEN)',
      })
    )
  ),

  key: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'API key value (e.g., $env.API_KEY)' })
    )
  ),

  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Secret for HMAC signature verification' })
    )
  ),

  algorithm: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'HMAC algorithm (e.g., sha256, sha512)' }))
  ),

  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Header name for API key (default: X-API-Key)' })
    )
  ),

  username: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Username for basic authentication' })
    )
  ),

  password: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Password for basic authentication' })
    )
  ),

  prefix: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'Bearer token prefix (default: Bearer)' }))
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookAuth',
    title: 'Webhook Authentication',
    description: 'Authentication configuration for incoming webhook requests',
  })
)

const WebhookResponseSchema = Schema.Struct({
  statusCode: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(100, 599),
      Schema.annotations({ description: 'HTTP status code to return' })
    )
  ),

  status: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(100, 599),
      Schema.annotations({ description: 'HTTP status code to return (alias for statusCode)' })
    )
  ),

  body: Schema.optional(
    Schema.Union(
      TemplateStringSchema,
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ).pipe(
      Schema.annotations({ description: 'Response body content (string template or JSON object)' })
    )
  ),

  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({ description: 'Additional response headers' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookResponse',
    title: 'Webhook Response',
    description: 'Custom response configuration for webhook endpoints',
  })
)

const WebhookRateLimitSchema = Schema.Struct({
  maxRequests: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum requests per window' })
    )
  ),

  windowSeconds: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Rate limit window in seconds' })
    )
  ),

  window: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Rate limit window in seconds (alias)' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookRateLimit',
    title: 'Webhook Rate Limit',
    description: 'Rate limiting configuration for webhook endpoints',
  })
)

export const WebhookTriggerSchema = Schema.Struct({
  type: Schema.Literal('webhook'),
  method: Schema.Union(
    Schema.Literal('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
    Schema.Array(Schema.Literal('GET', 'POST', 'PUT', 'PATCH', 'DELETE')).pipe(Schema.minItems(1))
  ).pipe(
    Schema.annotations({
      description: 'HTTP method(s) to accept (single or array). Required for webhook triggers.',
    })
  ),

  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Secret for HMAC signature verification (e.g., $env.WEBHOOK_SECRET)',
      })
    )
  ),
  respondImmediately: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Respond with 202 immediately or wait for completion (default: true)',
      })
    )
  ),

  auth: Schema.optional(WebhookAuthSchema),

  response: Schema.optional(WebhookResponseSchema),

  requestSchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'JSON Schema for validating the request body' })
    )
  ),

  querySchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'JSON Schema for validating query parameters' })
    )
  ),

  rateLimit: Schema.optional(WebhookRateLimitSchema),

  deduplicationKey: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Template expression to compute a dedup key (e.g. "{{body.orderId}}")',
      })
    )
  ),

  deduplicationWindow: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Dedup window in seconds (default: 300)' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'WebhookTrigger',
    title: 'Webhook Trigger',
    description: 'Trigger automation via incoming HTTP webhook',
  })
)

export type WebhookTrigger = Schema.Schema.Type<typeof WebhookTriggerSchema>
