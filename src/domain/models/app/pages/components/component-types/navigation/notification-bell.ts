/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `notification-bell` — the signed-in reader's own notifications, from the top
 * bar.
 *
 * It reads the store the top-level `notifications` key declares: a trigger
 * carrying the reader's unread count, and a popover listing her latest
 * `limit` notifications, newest first, with a "Mark all read" action. The
 * count follows the store live over the page's realtime connection; the bell
 * re-reads her list on each signal rather than trusting a pushed payload, so
 * what it draws is always what `GET /api/notifications` answers her.
 *
 * Opening the popover marks nothing read. Clicking an item marks THAT item
 * read and opens its source; "Mark all read" is the one explicit way to clear
 * the rest. An anonymous visitor has no notifications, so the bell draws
 * nothing for her — not an empty bell, which would announce a feature she
 * cannot use.
 *
 * A notification names its source by table and record id and copies none of
 * its fields, so where an item leads is the page's to say: `sourceHrefs` maps
 * a table to the address its records open at. An item whose table is not
 * mapped is listed, marked read when clicked, and goes nowhere.
 *
 * Not a composition of `popover` and `list`: the mark-all action and the live
 * count are store calls no composition of existing components reaches.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const NotificationBellTypeLiteral = Schema.Literal('notification-bell')

/** One table's record address, `{recordId}` filled from the notification's source. */
const SourceHrefSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "Address a notification about this table's records opens, with {recordId} filled from the notification's source",
    examples: ['/tickets/{recordId}', '/channels/{recordId}'],
  }),
  Schema.check(
    Schema.isPattern(/^\/[^\s]*\{recordId\}/, {
      message:
        'a notification source address must be a path on this site carrying {recordId}, such as /tickets/{recordId}',
    })
  )
)

export const notificationBellFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** The trigger's accessible name (default `Notifications`) */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Accessible name of the bell's trigger, read before its unread count; accepts a $t: key (default: Notifications)",
        examples: ['Notifications', '$t:nav.notifications'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** How many of the latest notifications the popover lists (default 20) */
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'How many of the latest notifications the popover lists, newest first',
        defaultNote: '20',
        examples: [10, 20],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(50))
    )
  ),
  /** Line shown when the reader has no notifications */
  emptyLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Line the popover shows when the reader has no notifications; accepts a $t: key (default: No notifications)',
        examples: ['Nothing new', '$t:nav.notificationsEmpty'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Label of the action that marks every notification read */
  markAllLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Label of the action that marks all her notifications read; accepts a $t: key (default: Mark all read)',
        examples: ['Mark all read', '$t:nav.markAllRead'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Where a notification about each table's records leads, by table name.
   * A notification stores its source's table and id only; this is how the
   * bell turns that into an address on this site.
   */
  sourceHrefs: Schema.optional(
    Schema.Record(Schema.String, SourceHrefSchema).annotate({
      description:
        'Map of a table to the address a notification about one of its records opens, {recordId} filled from the notification. A notification whose table is not mapped is listed and marked read when clicked, and opens nothing.',
      examples: [{ tickets: '/tickets/{recordId}', messages: '/channels/{recordId}' }],
    })
  ),
} as const
