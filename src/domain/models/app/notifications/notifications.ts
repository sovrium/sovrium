/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * `notifications` — the in-app notifications an app sends, declared by kind.
 *
 * The engine owns the store: each notification is a row of a system table
 * (recipient, kind, source table and record id, title, body, read flag,
 * created and read instants), written by the `notification` action and read
 * by its recipient alone through `/api/notifications`. The app declares no
 * table and writes no row rule, because a store every app hand-builds cannot be
 * read per recipient without a rule each app gets right on its own.
 *
 * A kind names what happened (a mention, a reply, an invitation) and the
 * channels it reaches by default. Each person may then turn a channel on or off
 * for a kind, so the defaults here are the starting point, never a ceiling.
 *
 * `retention.days` is counted from the instant a notification was READ; an
 * unread one listed in the app is never purged by it. A notification kept only
 * for the digest (not listed in the app) is never read, so its age is counted
 * from the instant it was created. No digest summary is sent yet. The shape is a table's `retention`
 * (`{ days }`) without its `field`.
 *
 * @example
 * ```yaml
 * notifications:
 *   kinds:
 *     - name: mention
 *       label: $t:notifications.kinds.mention
 *       channels: { inApp: true, email: true, digest: false }
 *     - name: reply
 *       channels: { inApp: true, email: false, digest: true }
 *   retention:
 *     days: 90
 * ```
 */

/** Smallest and largest read-notification retention, in days. */
export const MIN_NOTIFICATION_RETENTION_DAYS = 1
export const MAX_NOTIFICATION_RETENTION_DAYS = 36_500

/** A kind name: what an action's `kind` and a preference key refer to. */
const NOTIFICATION_KIND_NAME = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/

export const NotificationKindNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Notification Kind Name',
    description:
      'Name of the kind, as an action and a preference refer to it: lowercase letters and digits, words joined by - or _ (mention, reply, invitation-accepted).',
    examples: ['mention', 'reply', 'invitation-accepted'],
  }),
  Schema.check(
    Schema.isPattern(NOTIFICATION_KIND_NAME, {
      message:
        'A notification kind name is lowercase letters and digits, words joined by - or _ (for example mention or invitation-accepted).',
    })
  )
)

export const NotificationChannelsSchema = Schema.Struct({
  inApp: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true',
        description:
          'Whether a notification of this kind is listed in the recipient’s notifications (the bell and /api/notifications) by default.',
      })
    )
  ),
  email: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Whether a notification of this kind is also sent to the recipient’s account address by default, through the app’s email transport.',
      })
    )
  ),
  digest: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Whether a notification of this kind is kept for a later periodic summary by default. This version does not yet send that summary: a notification kept only for the digest is neither listed in the app nor emailed, and is removed retention.days after it was created, as a read notification is removed retention.days after it was read.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'NotificationChannels',
    title: 'Notification Channels',
    description:
      'The channels a kind reaches unless a person changes them in her notification preferences: listed in the app, sent by email, or kept for a periodic digest that this version does not yet send.',
  })
)

export const NotificationKindSchema = Schema.Struct({
  name: NotificationKindNameSchema,
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'How the kind is named to a person, in her notification preferences (a `$t:` key is accepted). Defaults to the name.',
        examples: ['Mentions', '$t:notifications.kinds.mention'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  channels: Schema.optional(NotificationChannelsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'NotificationKind',
    title: 'Notification Kind',
    description:
      'One kind of notification the app sends: its name, how it is labelled to a person, and the channels it reaches by default.',
  })
)

export const NotificationRetentionSchema = Schema.Struct({
  days: Schema.Finite.pipe(
    Schema.annotate({
      description:
        'How many days a notification is kept once it has been read. An unread notification listed in the app is never deleted by this rule; one kept only for the digest is deleted this many days after it was created. A whole number from 1 to 36500.',
    }),
    Schema.check(
      Schema.isInt(),
      Schema.isBetween({
        minimum: MIN_NOTIFICATION_RETENTION_DAYS,
        maximum: MAX_NOTIFICATION_RETENTION_DAYS,
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'NotificationRetention',
    title: 'Notification Retention',
    defaultNote: '{ days: 90 }',
    description:
      'How long read notifications are kept. Once a day, notifications read more than this many days ago are deleted for good; unread ones listed in the app stay, and ones kept only for the digest are deleted this many days after they were created.',
  })
)

const findDuplicateKind = (kinds: ReadonlyArray<{ readonly name: string }>): string | undefined =>
  kinds.map((kind) => kind.name).find((name, index, names) => names.indexOf(name) !== index)

export const NotificationsSchema = Schema.Struct({
  kinds: Schema.Array(NotificationKindSchema).pipe(
    Schema.annotate({
      description:
        'The kinds of notification the app sends. A `notification` action names one of them; a kind it does not declare is refused when the configuration is loaded.',
    }),
    Schema.check(Schema.isMinLength(1)),
    Schema.check(
      Schema.makeFilter((kinds) => {
        const duplicate = findDuplicateKind(kinds)
        return duplicate === undefined
          ? true
          : `notifications.kinds declares the kind "${duplicate}" twice; each kind name is declared once.`
      })
    )
  ),
  retention: Schema.optional(NotificationRetentionSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Notifications',
    title: 'Notifications',
    description:
      'In-app notifications, declared by kind. The engine keeps them per recipient, sends each through the channels its recipient chose for the kind, and lets her list them and mark them read through /api/notifications. Without this key the app sends none.',
    examples: [
      {
        kinds: [
          { name: 'mention', channels: { inApp: true, email: true } },
          { name: 'reply', channels: { inApp: true, digest: true } },
        ],
        retention: { days: 90 },
      },
    ],
  })
)

/** @public */
export type Notifications = Schema.Schema.Type<typeof NotificationsSchema>

/** @public */
export type NotificationKind = Schema.Schema.Type<typeof NotificationKindSchema>
