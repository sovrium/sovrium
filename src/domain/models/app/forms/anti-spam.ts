/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Rate Limit configuration for anti-spam.
 *
 * Both `perIp` and `perForm` are submission counts allowed within the
 * rolling `windowSeconds` time window.
 */
export const RateLimitSchema = Schema.Struct({
  /** Max submissions per IP within the window. */
  perIp: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
      description: 'Maximum submissions per IP within the time window',
    })
  ),
  /** Max submissions per form (across all IPs) within the window. */
  perForm: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
      description: 'Maximum submissions per form (all IPs) within the time window',
    })
  ),
  /** Sliding window in seconds. */
  windowSeconds: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
    description: 'Rolling time window in seconds for rate-limit counting',
  }),
}).annotations({
  identifier: 'RateLimit',
  title: 'Rate Limit',
  description: 'Rate-limit configuration for form submissions',
})

/**
 * Anti-Spam configuration for a form.
 *
 * - `honeypot`: when true, server adds a hidden field; submissions where the
 *   field is filled are silently rejected and stored as `status: spam`.
 * - `rateLimit`: per-IP and/or per-form sliding window throttle.
 * - `captcha`: name of a `connections[]` entry that provides CAPTCHA
 *   verification (Phase 3 — stub today).
 */
export const AntiSpamSchema = Schema.Struct({
  /** Toggle the hidden honeypot field. */
  honeypot: Schema.optional(
    Schema.Boolean.annotations({
      description: 'When true, server adds a hidden honeypot field; bots that fill it are blocked',
    })
  ),
  /** Sliding-window rate limits. */
  rateLimit: Schema.optional(RateLimitSchema),
  /** CAPTCHA connection name (stub for Phase 3). */
  captcha: Schema.optional(
    Schema.String.pipe(Schema.minLength(1)).annotations({
      description: 'Name of the CAPTCHA connection in app.connections (Phase 3)',
    })
  ),
}).annotations({
  identifier: 'AntiSpam',
  title: 'Anti-Spam Controls',
  description: 'Anti-spam controls for form submissions (honeypot, rate-limit, CAPTCHA stub)',
})

/** @public */
export type RateLimit = Schema.Schema.Type<typeof RateLimitSchema>
/** @public */
export type AntiSpam = Schema.Schema.Type<typeof AntiSpamSchema>
