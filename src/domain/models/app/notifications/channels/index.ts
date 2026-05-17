/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DigestConfigSchema } from '../digest-config'

// ─── Notification Channels ──────────────────────────────────────────────────

/**
 * Notification channel configuration — discriminated union on `type`.
 *
 * Two channel variants:
 * - `inApp`: In-app notification inbox
 * - `email`: Email notifications via SMTP with optional digest batching
 *
 * @example
 * ```typescript
 * // inApp channel
 * { type: 'inApp', enabled: true }
 *
 * // email channel with digest
 * {
 *   type: 'email',
 *   enabled: true,
 *   from: 'notifications@myapp.com',
 *   replyTo: 'support@myapp.com',
 *   digest: { defaultFrequency: 'daily', dailyTime: '09:00' },
 * }
 * ```
 */
export const NotificationChannelSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('inApp'),
    /** Whether this channel is active (defaults to true). */
    enabled: Schema.optional(Schema.Boolean),
  }),
  Schema.Struct({
    type: Schema.Literal('email'),
    /** Whether this channel is active (defaults to true). */
    enabled: Schema.optional(Schema.Boolean),
    /** Sender email address for notification emails. */
    from: Schema.String.pipe(
      Schema.annotations({
        title: 'From Address',
        description: 'Sender email address for notification emails',
      })
    ),
    /** Reply-to email address (optional). */
    replyTo: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Reply-to email address' }))
    ),
    /** Email digest batching configuration (optional). */
    digest: Schema.optional(DigestConfigSchema),
  })
).pipe(
  Schema.annotations({
    identifier: 'NotificationChannel',
    title: 'Notification Channel',
    description: 'Notification delivery channel (inApp or email)',
  })
)
