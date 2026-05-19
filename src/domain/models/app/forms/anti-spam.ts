/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const RateLimitSchema = Schema.Struct({
  perIp: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
      description: 'Maximum submissions per IP within the time window',
    })
  ),
  perForm: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
      description: 'Maximum submissions per form (all IPs) within the time window',
    })
  ),
  windowSeconds: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)).annotations({
    description: 'Rolling time window in seconds for rate-limit counting',
  }),
}).annotations({
  identifier: 'RateLimit',
  title: 'Rate Limit',
  description: 'Rate-limit configuration for form submissions',
})

export const AntiSpamSchema = Schema.Struct({
  honeypot: Schema.optional(
    Schema.Boolean.annotations({
      description: 'When true, server adds a hidden honeypot field; bots that fill it are blocked',
    })
  ),
  rateLimit: Schema.optional(RateLimitSchema),
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

export type RateLimit = Schema.Schema.Type<typeof RateLimitSchema>
export type AntiSpam = Schema.Schema.Type<typeof AntiSpamSchema>
