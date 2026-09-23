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
  type: Schema.Literals(['bearer', 'apiKey', 'hmac', 'basic']).pipe(
    Schema.annotate({ description: 'Authentication mechanism for incoming webhooks' })
  ),

  /** Token or secret value (supports template references like $env.SECRET) */
  token: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Bearer token or API key value (e.g., $env.WEBHOOK_TOKEN)',
      })
    )
  ),

  /** API key value (alternative to token for apiKey auth) */
  key: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({ description: 'API key value (e.g., $env.API_KEY)' })
    )
  ),

  /** Secret for HMAC signature verification */
  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Secret for HMAC signature verification' })
    )
  ),

  /** HMAC algorithm (default: sha256) */
  algorithm: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'HMAC algorithm (e.g., sha256, sha512)' }))
  ),

  /** Header name for API key authentication */
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Header name for API key (default: X-API-Key)' })
    )
  ),

  /** Username for basic auth */
  username: Schema.optional(
    TemplateStringSchema.pipe(Schema.annotate({ description: 'Username for basic authentication' }))
  ),

  /** Password for basic auth */
  password: Schema.optional(
    TemplateStringSchema.pipe(Schema.annotate({ description: 'Password for basic authentication' }))
  ),

  /** Bearer token prefix (e.g., 'Bot' for 'Bot <token>') */
  prefix: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Bearer token prefix (default: Bearer)' }))
  ),
}).pipe(
  Schema.annotate({
    // Distinct from the OUTGOING webhook auth union's `WebhookAuth` identifier
    // (`src/domain/models/app/tables/webhooks/auth.ts`). A shared identifier
    // collapses both into one JSON Schema `$def`, erasing this one from the
    // public schema — see the collision test in
    // `src/domain/models/app/app-json-schema.test.ts`.
    identifier: 'IncomingWebhookAuth',
    title: 'Incoming Webhook Authentication',
    description: 'Authentication configuration for incoming webhook requests',
  })
)

/**
 * Webhook custom response configuration.
 */
const WebhookResponseSchema = Schema.Struct({
  /** HTTP status code to return */
  statusCode: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'HTTP status code to return' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 }))
    )
  ),

  /** HTTP status code (alias for statusCode) */
  status: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'HTTP status code to return (alias for statusCode)' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 }))
    )
  ),

  /** Response body (string, template, or object) */
  body: Schema.optional(
    Schema.Union([TemplateStringSchema, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
      Schema.annotate({ description: 'Response body content (string template or JSON object)' })
    )
  ),

  /** Additional response headers */
  headers: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({ description: 'Additional response headers' })
    )
  ),
}).pipe(
  Schema.annotate({
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
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum requests per window' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Time window in seconds */
  windowSeconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Rate limit window in seconds' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Time window in seconds (alias for windowSeconds) */
  window: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Rate limit window in seconds (alias)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookRateLimit',
    title: 'Webhook Rate Limit',
    description: 'Rate limiting configuration for webhook endpoints',
  })
)

export const WebhookTriggerSchema = Schema.Struct({
  type: Schema.Literal('webhook').pipe(
    Schema.annotate({
      description: "Constant value 'webhook' for type discrimination in discriminated unions",
    })
  ),
  method: Schema.Union([
    Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    Schema.Array(Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])).pipe(
      Schema.check(Schema.isMinLength(1))
    ),
  ]).pipe(
    Schema.annotate({
      description: 'HTTP method(s) to accept (single or array). Required for webhook triggers.',
    })
  ),

  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Secret for HMAC signature verification (e.g., $env.WEBHOOK_SECRET)',
      })
    )
  ),
  /**
   * The default is FALSE, and the read site is what decides it: the async
   * dispatcher is entered only on `respondImmediately === true`
   * (`webhook-handler.ts`), so an omitted value takes the synchronous path and
   * the caller waits for the run. The annotation below said "default: true"
   * for as long as this property existed, which is the opposite of what ships.
   */
  respondImmediately: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Answer 202 as soon as the run is queued instead of holding the request open until it finishes. Omitted, the caller waits for the run to complete.',
      })
    )
  ),

  /** Authentication configuration for incoming requests */
  auth: Schema.optional(WebhookAuthSchema),

  /** Custom response configuration */
  response: Schema.optional(WebhookResponseSchema),

  /** JSON Schema for request body validation */
  requestSchema: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({ description: 'JSON Schema for validating the request body' })
    )
  ),

  /** JSON Schema for query parameter validation */
  querySchema: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({ description: 'JSON Schema for validating query parameters' })
    )
  ),

  /** Rate limiting configuration */
  rateLimit: Schema.optional(WebhookRateLimitSchema),

  /**
   * Template expression resolved against the request body to produce a
   * dedup key (e.g. `'{{body.orderId}}'`). When two requests within the
   * dedup window resolve to the same key, the second is silently dropped
   * — no run row, no side effects. Following Zapier's trigger dedup
   * pattern; [internal ref].
   */
  deduplicationKey: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Template expression to compute a dedup key (e.g. "{{body.orderId}}")',
      })
    )
  ),

  /**
   * Window (in seconds) during which a previously-seen dedup key blocks
   * fresh requests. Defaults to 300 (5 minutes) when `deduplicationKey`
   * is set but no explicit window is provided. [internal ref].
   */
  deduplicationWindow: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '300',
        description: 'Dedup window in seconds (default: 300)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookTrigger',
    title: 'Webhook Trigger',
    description: 'Trigger automation via incoming HTTP webhook',
  })
)

/** @public */
export type WebhookTrigger = Schema.Schema.Type<typeof WebhookTriggerSchema>
