/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `page.invitation` — the page an invitation link opens, and the facts it may
 * print about that invitation.
 *
 * ─── THE TOKEN IS READ FROM THE ADDRESS, NEVER FROM CONFIG ────────────────
 *
 * An invitation link carries its token in the query string (`?token=…` by
 * default, `param` renames it). Declaring `invitation` on a page tells the
 * engine to look that token up once per render and to expose what it found as
 * `$invitation.*`, usable anywhere a string is:
 *
 * | Reference                  | Value                                              |
 * | -------------------------- | -------------------------------------------------- |
 * | `$invitation.inviter.name` | Name of the person who sent the invitation          |
 * | `$invitation.inviter.image`| Their avatar URL, empty when they have none          |
 * | `$invitation.email`        | Address the invitation was sent to                   |
 * | `$invitation.role`         | Role the invitee will hold                           |
 * | `$invitation.workspace`    | The app's name                                       |
 * | `$invitation.expiresAt`    | ISO 8601 instant the invitation stops working        |
 * | `$invitation.accountExists`| `true` when the address already has an account       |
 * | `$invitation.status`       | `pending`, `expired` or `invalid`                    |
 *
 * A token that matches no outstanding invitation — an unknown one, or one
 * already accepted or revoked, whose row is gone — resolves `$invitation.status`
 * to `invalid` and every other reference to an empty string, so the page can say "This
 * invitation link is not valid" without saying whether it ever existed. The
 * accept and decline methods (`auth` action) read the same token, so the page
 * needs no hidden field to carry it.
 */

import { Schema } from 'effect'

export const PageInvitationSchema = Schema.Struct({
  param: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: "URL query key the invitation token is read from (default: 'token')",
        examples: ['token', 'invite'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'PageInvitation',
  title: 'Page Invitation',
  description:
    'Look up the invitation whose token is in the page address and expose it as $invitation.* (inviter.name, inviter.image, email, role, workspace, expiresAt, accountExists, status). status reads pending, expired or invalid; an invalid token empties every other reference',
})
