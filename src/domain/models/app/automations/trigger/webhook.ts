/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../template'

/**
 * Webhook Trigger
 *
 * Receives external HTTP calls at a generated endpoint.
 * URL format: /api/automations/{automationName}/webhook
 */
/**
 * Webhook authentication configuration.
 *
 * Supports bearer tokens, API keys, and HMAC signature verification.
 */
const WebhookAuthSchema = Schema.Struct({
  /** Authentication type */
  type: Schema.Literal('bearer', 'apiKey', 'hmac', 'basic').pipe(
    Schema.annotations({ description: 'Authentication mechanism for incoming webhooks' })
  ),

  /** Token or secret value (supports template references like $env.SECRET) */
  token: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Bearer token or API key value (e.g., $env.WEBHOOK_TOKEN)',
      })
    )
  ),

  /** API key value (alternative to token for apiKey auth) */
  key: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'API key value (e.g., $env.API_KEY)' })
    )
  ),

  /** Secret for HMAC signature verification */
  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Secret for HMAC signature verification' })
    )
  ),

  /** HMAC algorithm (default: sha256) */
  algorithm: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'HMAC algorithm (e.g., sha256, sha512)' }))
  ),

  /** Header name for API key authentication */
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Header name for API key (default: X-API-Key)' })
    )
  ),

  /** Username for basic auth */
  username: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Username for basic authentication' })
    )
  ),

  /** Password for basic auth */
  password: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Password for basic authentication' })
    )
  ),

  /** Bearer token prefix (e.g., 'Bot' for 'Bot <token>') */
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

/**
 * Webhook custom response configuration.
 */
const WebhookResponseSchema = Schema.Struct({
  /** HTTP status code to return */
  statusCode: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(100, 599),
      Schema.annotations({ description: 'HTTP status code to return' })
    )
  ),

  /** HTTP status code (alias for statusCode) */
  status: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(100, 599),
      Schema.annotations({ description: 'HTTP status code to return (alias for statusCode)' })
    )
  ),

  /** Response body (string, template, or object) */
  body: Schema.optional(
    Schema.Union(
      TemplateStringSchema,
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ).pipe(
      Schema.annotations({ description: 'Response body content (string template or JSON object)' })
    )
  ),

  /** Additional response headers */
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

/**
 * Webhook rate limiting configuration.
 */
const WebhookRateLimitSchema = Schema.Struct({
  /** Maximum number of requests in the window */
  maxRequests: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Maximum requests per window' })
    )
  ),

  /** Time window in seconds */
  windowSeconds: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({ description: 'Rate limit window in seconds' })
    )
  ),

  /** Time window in seconds (alias for windowSeconds) */
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

  /** Authentication configuration for incoming requests */
  auth: Schema.optional(WebhookAuthSchema),

  /** Custom response configuration */
  response: Schema.optional(WebhookResponseSchema),

  /** JSON Schema for request body validation */
  requestSchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'JSON Schema for validating the request body' })
    )
  ),

  /** JSON Schema for query parameter validation */
  querySchema: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({ description: 'JSON Schema for validating query parameters' })
    )
  ),

  /** Rate limiting configuration */
  rateLimit: Schema.optional(WebhookRateLimitSchema),

  /**
   * Template expression resolved against the request body to produce a
   * dedup key (e.g. `'{{body.orderId}}'`). When two requests within the
   * dedup window resolve to the same key, the second is silently dropped
   * — no run row, no side effects. Following Zapier's trigger dedup
   * pattern; APP-AUTOMATION-RETRY-016.
   */
  deduplicationKey: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Template expression to compute a dedup key (e.g. "{{body.orderId}}")',
      })
    )
  ),

  /**
   * Window (in seconds) during which a previously-seen dedup key blocks
   * fresh requests. Defaults to 300 (5 minutes) when `deduplicationKey`
   * is set but no explicit window is provided. APP-AUTOMATION-RETRY-016.
   */
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

/** @public */
export type WebhookTrigger = Schema.Schema.Type<typeof WebhookTriggerSchema>
