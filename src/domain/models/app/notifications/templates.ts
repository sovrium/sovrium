/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Notification Templates ─────────────────────────────────────────────────

/**
 * Notification template schema.
 *
 * Templates define the content of notifications with {{variable}} substitution.
 * Each template specifies which channels it should be delivered through.
 *
 * @example
 * ```typescript
 * {
 *   title: 'New {{tableName}} record',
 *   body: '{{userName}} created a new record in {{tableName}}: {{recordTitle}}',
 *   channels: ['inApp', 'email'],
 * }
 * ```
 */
export const NotificationTemplateSchema = Schema.Struct({
  /** Notification title with {{variable}} substitution support. */
  title: Schema.String.pipe(
    Schema.annotations({
      title: 'Template Title',
      description: 'Notification title template with {{variable}} substitution',
    })
  ),

  /** Notification body with {{variable}} substitution support. */
  body: Schema.String.pipe(
    Schema.annotations({
      title: 'Template Body',
      description: 'Notification body template with {{variable}} substitution',
    })
  ),

  /** Channels this template delivers through (optional, defaults to all configured channels). */
  channels: Schema.optional(
    Schema.Array(Schema.Literal('inApp', 'email')).pipe(
      Schema.annotations({
        title: 'Template Channels',
        description: 'Which channels this notification is delivered through',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'NotificationTemplate',
    title: 'Notification Template',
    description: 'Named notification template with title, body, and channel targeting.',
  })
)
