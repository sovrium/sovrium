/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Session-bound text binding — render the SIGNED-IN caller's OWN session field.
 *
 * A generic way for a display component to show "logged in as X": the value is
 * resolved CLIENT-SIDE from the caller's own session (`GET /api/auth/get-session`),
 * never server-rendered or cached across users. This is the config form of the
 * pattern the bespoke admin "Mon identité" card hand-rolls (it fetches the session
 * and prints `user.email`); lifting it to config lets ANY app surface the logged-in
 * user's identity declaratively.
 *
 * Two cooperating surfaces (this module owns the field; the token is a string
 * convention resolved by the client at runtime):
 *
 *  1. The `session` field on a `text` component renders the caller's chosen session
 *     field directly (`session: email` → the text shows the logged-in user's email).
 *  2. The `$session.<field>` interpolation TOKEN (e.g. `$session.email`) is usable in
 *     a `text` component's `content`, in a confirm gate's `input.matchValue` (the
 *     type-to-confirm "retype your own email" gate), and in a fetch action's `body` —
 *     anywhere a string value is resolved client-side against the caller's session.
 *     No schema change is needed for the token: the host fields are already
 *     `Schema.String` / `Schema.Unknown`; the token is documented here so the client
 *     resolver and the config author share ONE field vocabulary.
 *
 * The resolvable session fields are deliberately limited to non-sensitive identity
 * fields (the same `{ user }` envelope `GET /api/auth/get-session` returns): the
 * caller's own `email`, display `name`, `role`, and `id`. Nothing here exposes other
 * users' data — every value is the CALLER's own session.
 *
 * @example
 * ```yaml
 * # Render the logged-in user's own email
 * - type: text
 *   element: span
 *   session: email
 *
 * # Token form in text content
 * - type: text
 *   content: 'Connecté en tant que $session.email'
 * ```
 */

/**
 * A field of the signed-in caller's OWN session, resolvable client-side from
 * `GET /api/auth/get-session`. Doubles as the `<field>` segment of the
 * `$session.<field>` interpolation token.
 */
export const SessionFieldSchema = Schema.Literals(['email', 'name', 'role', 'id']).annotate({
  identifier: 'SessionField',
  title: 'Session Field',
  description:
    "A field of the signed-in caller's OWN session (email/name/role/id), resolved client-side from GET /api/auth/get-session. Also the <field> of the $session.<field> interpolation token.",
})

/**
 * The `session` display field — available on display components (e.g. `text`) that
 * render the caller's own session value.
 */
export const sessionFields = {
  /**
   * Render the signed-in caller's OWN session field (email/name/role/id), resolved
   * client-side from `GET /api/auth/get-session`. Generic — any app showing
   * "logged in as X". Mutually independent from `content`: when both are set the
   * component renders the resolved session value (the `content` is the loading/SSR
   * placeholder). Anonymous callers render nothing (the surface stays calm).
   */
  session: Schema.optional(
    SessionFieldSchema.annotate({
      description:
        "Render the signed-in caller's OWN session field (email/name/role/id), resolved client-side from GET /api/auth/get-session. Generic: any app showing 'logged in as X'. Renders nothing for anonymous callers.",
    })
  ),
} as const

/** @public */
export type SessionField = Schema.Schema.Type<typeof SessionFieldSchema>
