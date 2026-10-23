/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * App-wide presence — `auth.presence`.
 *
 * Page `presence: true` answers "who is on this page or this record". This
 * answers "is this person online anywhere in the app", when she was last seen,
 * and who is typing in a conversation. It is opt-in and NAMES its audience,
 * because an online status reveals a person's activity: the operator says
 * which roles may see it, and nobody else is told it exists.
 *
 * - A person is online while one of her realtime connections is open;
 *   `lastSeen` is written whenever one of her connections closes, never per
 *   heartbeat, and is shown only while she is offline.
 * - `online` and `lastSeen` are read on the account directory
 *   (`GET /api/users/directory`), for a reader whose role is in `visibleTo`
 *   only. They are not filterable or sortable, and they do not appear on the
 *   value of a `user` field.
 * - Typing signals are relayed by the server between readers of one record
 *   whose role is in `visibleTo` — and only when `typing: true` is declared.
 *   The composer that sends them and the "is typing" label belong to the
 *   conversation components.
 * - An anonymous visitor receives none of it, whatever `visibleTo` says.
 *
 * @example
 * ```yaml
 * auth:
 *   strategies:
 *     - type: emailAndPassword
 *   presence:
 *     visibleTo: [admin, member]
 *     lastSeen: true
 *     typing: true
 * ```
 */
export const AuthPresenceSchema = Schema.Struct({
  visibleTo: Schema.Array(
    Schema.String.pipe(
      Schema.annotate({ description: 'A role, built in or declared under auth.roles.' }),
      Schema.check(Schema.isMinLength(1))
    )
  ).pipe(
    Schema.annotate({
      description:
        'The roles that see who is online, their last-seen time when lastSeen is on, and who is typing when typing is on. A reader of any other role receives none of it and is not told it exists; an anonymous visitor never receives it. At least one role.',
      examples: [['admin', 'member']],
    }),
    Schema.check(
      Schema.isMinLength(1, {
        message:
          'auth.presence.visibleTo names at least one role: presence nobody may see is presence turned off, which is what leaving auth.presence out says.',
      })
    )
  ),
  lastSeen: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Keep, per person, the time one of her realtime connections last closed, read as lastSeen on the account directory (GET /api/users/directory) by the roles in visibleTo while she is offline. Not filterable or sortable, and not on user fields. It is personal data: listed in her account export and deleted with her account.',
      })
    )
  ),
  typing: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Relay typing signals between the readers of one record whose role is in visibleTo: the server passes on who is writing under that record, to those readers only. A composer that sends these signals and an "is typing" label that shows them are part of the conversation components.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AuthPresence',
    title: 'Presence',
    description:
      'App-wide presence: who is online, when each person was last seen, and who is typing, shown only to the roles named in visibleTo and never to anonymous visitors. Without it, only page presence (a page’s presence: true) exists.',
    examples: [{ visibleTo: ['admin', 'member'], lastSeen: true, typing: true }],
  })
)

/** @public */
export type AuthPresence = Schema.Schema.Type<typeof AuthPresenceSchema>
