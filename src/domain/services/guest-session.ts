/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Guest-session sentinel (single source of truth).
 *
 * Unauthenticated callers that are nonetheless allowed to act (the
 * guest-comment auth-exemption middleware, automation-driven record creation)
 * carry a synthetic session whose `userId` is the literal {@link GUEST_USER_ID}.
 * It is NOT a Better Auth user row — persistence layers translate it to SQL
 * `NULL` for any `user_id` FK, and the guest name/email columns carry the
 * attribution instead.
 *
 * Pure-domain so every layer (presentation middleware, application use-cases,
 * infrastructure query helpers) shares one definition of "is this a guest?"
 * rather than each inlining the `=== 'guest'` magic-string comparison.
 */
export const GUEST_USER_ID = 'guest'

/**
 * System-authority sentinel (single source of truth).
 *
 * Trusted server-side writers that act WITHOUT a human caller — record
 * CREATE/UPDATE driven by an automation engine — carry a synthetic session
 * whose `userId` is the literal {@link SYSTEM_USER_ID}. Unlike {@link
 * GUEST_USER_ID}, it is NOT translated to SQL `NULL`: it is a real, durable
 * actor id that satisfies NOT-NULL authorship columns (`created-by` /
 * `updated-by`-typed fields are generated `TEXT NOT NULL` when auth is
 * configured, and carry NO foreign key to `auth.user`, so a non-row sentinel
 * is a valid value).
 *
 * Pure-domain so every layer shares one definition of "is this the system
 * actor?" rather than inlining the magic string.
 */
export const SYSTEM_USER_ID = 'system'

/**
 * `true` when a session userId is the guest sentinel (unauthenticated).
 */
export function isGuestSession(userId: string | undefined): boolean {
  return userId === GUEST_USER_ID
}

/**
 * `true` when a session userId is the system-authority sentinel.
 */
export function isSystemSession(userId: string | undefined): boolean {
  return userId === SYSTEM_USER_ID
}

/**
 * `true` when a session userId belongs to a real (authenticated) user —
 * the inverse of {@link isGuestSession}.
 */
export function isAuthenticatedSession(userId: string | undefined): boolean {
  return !isGuestSession(userId)
}

/**
 * Narrow a session userId down to the one that a `auth.user` foreign key can
 * actually hold, or `undefined` when no such user exists.
 *
 * Distinct from {@link isAuthenticatedSession}, which only rules out the guest
 * sentinel: BOTH sentinels are collapsed here, because neither {@link
 * GUEST_USER_ID} nor {@link SYSTEM_USER_ID} is a row in `auth.user`. Authorship
 * columns are plain `TEXT` with no FK, so they can and do store the system
 * sentinel verbatim (see `normalizeUserIdForDb`); a column that genuinely
 * REFERENCES `auth.user(id)` cannot, and an insert carrying `'system'` is
 * rejected outright by the constraint.
 *
 * Absence is `undefined` rather than the empty string so callers spread it away
 * and the column lands as SQL NULL — keeping `IS NULL` the entire
 * "no human caused this" predicate.
 */
export function resolveActorUserId(userId: string | undefined): string | undefined {
  if (!userId || isGuestSession(userId) || isSystemSession(userId)) return undefined
  return userId
}
