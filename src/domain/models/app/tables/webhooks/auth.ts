/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Webhook Authentication ─────────────────────────────────────────────────

/**
 * Webhook authentication — discriminated union on `type`.
 *
 * - `hmac`: HMAC signature of request body (most secure)
 * - `apiKey`: Static API key in a custom header
 * - `bearer`: Bearer token in Authorization header
 *
 * Secrets support `$env.` references for environment variable injection.
 *
 * @example
 * ```typescript
 * // HMAC signature
 * { type: 'hmac', secret: '$env.PARTNER_WEBHOOK_SECRET', algorithm: 'sha256' }
 *
 * // API key
 * { type: 'apiKey', key: '$env.SERVICE_API_KEY', header: 'X-API-Key' }
 *
 * // Bearer token
 * { type: 'bearer', token: '$env.API_BEARER_TOKEN' }
 * ```
 */
export const WebhookAuthSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('hmac'),
    /** HMAC secret (supports $env. references). */
    secret: Schema.String.pipe(
      Schema.annotations({ description: 'HMAC secret for signing (supports $env. references)' })
    ),
    /** Hash algorithm (default: sha256). */
    algorithm: Schema.optional(
      Schema.Literal('sha256', 'sha1').pipe(
        Schema.annotations({ description: 'HMAC hash algorithm' })
      )
    ),
    /** Header name for the signature (default: X-Signature). */
    header: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Header name for the HMAC signature' }))
    ),
  }),
  Schema.Struct({
    type: Schema.Literal('apiKey'),
    /** API key value (supports $env. references). */
    key: Schema.String.pipe(
      Schema.annotations({ description: 'API key value (supports $env. references)' })
    ),
    /** Header name for the API key (default: X-Api-Key). */
    header: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Header name for the API key' }))
    ),
  }),
  Schema.Struct({
    type: Schema.Literal('bearer'),
    /** Bearer token value (supports $env. references). */
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
