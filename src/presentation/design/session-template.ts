/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The session TEMPLATE grammar — ONE pure `template × session → string`
 * resolution, shared by the two surfaces that have to agree on it letter for
 * letter.
 *
 * It lives here, in the neutral leaf, for the reason `avatar-initials.ts` does:
 * `render/` (the server's session-less SSR placeholder) and `islands/` (the
 * browser's fill, once `GET /api/auth/get-session` has answered) may not import
 * each other, and a grammar written twice is a grammar that drifts. When it
 * drifts, the text CHANGES SHAPE on hydration — the defect is a visible reflow
 * on the first thing a reader looks at, not a wrong value.
 *
 * The server is simply the anonymous case: `resolveSessionTemplate(t, undefined)`
 * IS the SSR placeholder, so there is no second code path to keep honest.
 *
 * ─── THE GRAMMAR ───────────────────────────────────────────────────────────
 *
 *   1. `$session.<field>` OUTSIDE any group — resolved against the caller's own
 *      session, or replaced by the empty string. Unchanged from the day it
 *      shipped; every page already written against the token form reads the
 *      same.
 *   2. `[ … ]` CONTAINING at least one token — an OPTIONAL SEGMENT, one
 *      grammatical unit. Every token inside resolves non-empty → the brackets
 *      are dropped and the segment is kept (`Welcome, Alice Johnson`). ANY token
 *      inside resolves empty → the WHOLE segment goes, its literals with it
 *      (`Welcome`). All-or-nothing, because a half-resolved unit is exactly the
 *      dangling-punctuation defect the segment exists to prevent.
 *   3. `[ … ]` containing NO token — ordinary punctuation, left verbatim,
 *      brackets included. Square brackets are prose in English and French, and a
 *      grammar that ate `[draft]` would corrupt pages nobody edited.
 *
 * Groups do not nest: the inner character class excludes both brackets, so an
 * unmatched or nested bracket is simply text and survives untouched.
 *
 * Neither side writes HTML. The resolved value becomes React children on the
 * server and a `replaceChildren` text node in the browser, so a display name
 * carrying markup renders as the characters the user typed (security rule S2).
 */

/** The signed-in caller's OWN session identity (the `{ user }` envelope subset). */
export interface SessionUser {
  readonly email?: string
  readonly name?: string
  readonly role?: string
  readonly id?: string
}

/**
 * The `$session.<field>` interpolation token.
 *
 * Shared across `split` / `matchAll` / `replaceAll` deliberately and safely:
 * `split` and `matchAll` each operate on an internal clone, and `replaceAll`
 * resets `lastIndex` to 0 at both ends of its walk. Nothing here observes the
 * regex's own cursor.
 */
const SESSION_TOKEN = /\$session\.(\w+)/g

/** A `[ … ]` group. Non-nesting BY CONSTRUCTION — the class excludes brackets. */
const OPTIONAL_SEGMENT = /\[([^[\]]*)\]/g

/** The marker that makes a group a SEGMENT rather than ordinary punctuation. */
const TOKEN_MARKER = '$session.'

/** One field of the caller's own session. An absent field is the empty string. */
function resolveField(user: SessionUser | undefined, field: string): string {
  const value = user ? (user as Record<string, unknown>)[field] : undefined
  return value === undefined || value === null ? '' : String(value)
}

/** Token substitution as it has always worked, outside any group. */
function substituteTokens(text: string, user: SessionUser | undefined): string {
  return text.replaceAll(SESSION_TOKEN, (_full, field: string) => resolveField(user, field))
}

/** The all-or-nothing rule: a segment survives only if EVERY token in it fills. */
function segmentSurvives(inner: string, user: SessionUser | undefined): boolean {
  return [...inner.matchAll(SESSION_TOKEN)].every(
    ([, field]) => resolveField(user, field ?? '') !== ''
  )
}

/** One `[ … ]` group: copy without a token, segment with one. */
function resolveGroup(inner: string, user: SessionUser | undefined): string {
  if (!inner.includes(TOKEN_MARKER)) return `[${inner}]`
  return segmentSurvives(inner, user) ? substituteTokens(inner, user) : ''
}

/**
 * Resolve `template` against the caller's own session.
 *
 * `user` is `undefined` for an anonymous caller AND for every server render —
 * the SSR pass is session-less by design, which is what makes the served bytes a
 * grammatical sentence naming nobody, and keeps a cached page from carrying one
 * reader's identity to the next.
 *
 * The split yields alternating parts — even indices are the text OUTSIDE any
 * group, odd indices are one group's inner content — because the pattern carries
 * exactly one capture. Resolving them separately is what keeps a resolved value
 * inert: a display name that happened to contain `$session.email` is written
 * once and never re-scanned.
 */
export function resolveSessionTemplate(template: string, user: SessionUser | undefined): string {
  if (!template.includes(TOKEN_MARKER)) return template
  return template
    .split(OPTIONAL_SEGMENT)
    .map((part, index) =>
      index % 2 === 0 ? substituteTokens(part, user) : resolveGroup(part, user)
    )
    .join('')
}
