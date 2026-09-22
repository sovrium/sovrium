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
 *  3. The `[ … ]` OPTIONAL SEGMENT — the third surface, and the one that makes a
 *     session-bound SENTENCE possible rather than only a session-bound value. See
 *     below; it is also a string convention and needs no schema change.
 *
 * The resolvable session fields are deliberately limited to non-sensitive identity
 * fields (the same `{ user }` envelope `GET /api/auth/get-session` returns): the
 * caller's own `email`, display `name`, `role`, and `id`. Nothing here exposes other
 * users' data — every value is the CALLER's own session.
 *
 * ─── THE OPTIONAL SEGMENT: `Welcome[, $session.name]` ──────────────────────────
 *
 * A bare token cannot carry its own punctuation. `content: 'Welcome, $session.name'`
 * is well-formed config that produces a defect twice over: the SSR pass is
 * session-less by design and strips the token, serving `Welcome, ` with a dangling
 * comma to every no-JS reader; and a signed-in caller whose account carries no
 * display name resolves the token to the empty string and reads the same thing. The
 * literal and the value are one grammatical unit, and nothing in the token form says
 * so.
 *
 * A `[ … ]` group CONTAINING at least one `$session.<field>` token is that unit:
 *
 *   - every token inside resolves NON-EMPTY → the brackets are dropped and the
 *     segment is kept, tokens resolved (`Welcome, Alice Johnson`);
 *   - ANY token inside resolves empty — field absent from the envelope, `null`, the
 *     empty string, or an anonymous caller → the WHOLE segment is removed, its
 *     literals with it (`Welcome`). All-or-nothing, because a half-resolved unit is
 *     precisely the dangling-punctuation defect the segment exists to prevent.
 *
 * Three rules keep it from reaching copy that never asked for it:
 *
 *   - a `[ … ]` group containing NO `$session.` token is left verbatim, brackets
 *     included — existing copy reading `[draft]` is untouched;
 *   - groups do not nest, and a group may not contain `[` or `]`;
 *   - a token OUTSIDE any group keeps its current behaviour (resolved, or replaced
 *     by the empty string). Nothing already shipped changes meaning.
 *
 * The SERVER drops every optional segment, because it has no session — which is what
 * makes the served bytes a grammatical sentence rather than a stranded literal, and
 * keeps a statically cached page naming nobody. Hydration then ADDS the segment. That
 * direction matters: a heading that says `Welcome` and grows is readable at every
 * instant, where one that arrives empty and fills in is a layout shift on the first
 * thing a reader looks at.
 *
 * The resolved value is written as a TEXT NODE on both sides (React children on the
 * server, `replaceChildren` on the client), so a display name carrying markup renders
 * as the characters the user typed and never as an element (security rule S2).
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
 *
 * # Optional segment: named where the caller has a name, grammatical where not
 * - type: text
 *   element: h1
 *   content: 'Welcome[, $session.name]'
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
