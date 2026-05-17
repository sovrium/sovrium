/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Notification Bell Component Schema
 *
 * Configuration for the notification bell page component.
 * Displays an unread count badge and dropdown inbox in the page header.
 *
 * Only rendered when `notifications` is configured in the app schema.
 *
 * @example
 * ```typescript
 * // In a page component list
 * { type: 'notificationBell', position: 'right' }
 *
 * // Default position (right)
 * { type: 'notificationBell' }
 * ```
 */
export const NotificationBellSchema = Schema.Struct({
  /** Position of the bell icon in the header (default: right). */
  position: Schema.optional(
    Schema.Literal('left', 'right').pipe(
      Schema.annotations({
        title: 'Bell Position',
        description: 'Position of the notification bell in the header (default: right)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'NotificationBell',
    title: 'Notification Bell',
    description:
      'Page component displaying notification badge count and dropdown inbox. Only rendered when notifications are configured.',
    examples: [{ position: 'right' }, {}],
  })
)

export type NotificationBell = Schema.Schema.Type<typeof NotificationBellSchema>
export type NotificationBellEncoded = Schema.Schema.Encoded<typeof NotificationBellSchema>
