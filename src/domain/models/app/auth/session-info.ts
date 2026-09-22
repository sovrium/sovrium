/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lightweight session information for page access control
 *
 * This is a domain-level type that represents the minimal session
 * data needed to make access control decisions. It is intentionally
 * decoupled from the full Better Auth session to keep the domain
 * layer free of infrastructure concerns.
 *
 * Z-1 ($currentUser references in dataSource.filter):
 * - `email` enables `$currentUser.email` filter resolution.
 * - `isUnrestricted` enables `$currentUser.isUnrestricted` bypass for
 *   global engineers (Better Auth admin role) — when true, the engine
 *   skips assignment-scoped filters and shows all records.
 *
 * Both fields are optional for backward compatibility with existing
 * consumers that only need user id / role.
 *
 * `groups` lists the (un-prefixed) names of every Sovrium group the user
 * belongs to. Group-based page access (`access: ['group:marketing']`) is
 * granted when the requested `group:<name>` matches any entry here.
 */
export interface SessionInfo {
  readonly userId: string
  readonly role: string
  readonly email?: string
  /**
   * Display name from Better Auth (mirror of `session.user.name`). Used by
   * the SSR guest-comment renderer (PG-02 [internal ref]) to
   * prefill the visible name input when the visitor is already
   * authenticated. Optional for backward compatibility — pages that only
   * use the existing fields keep working unchanged.
   */
  readonly name?: string
  /**
   * The account's own interface-language preference, as STORED — the raw value
   * the person chose, not a locale resolved for any particular app.
   *
   * Deliberately unresolved: one account can be served several apps from one
   * origin (the embedded operator console is a second app on the operator's own
   * origin), and each declares its own languages. Resolving here would bake in
   * whichever app happened to read the session first. The clamp belongs at the
   * point of use, against the languages of the app actually being rendered.
   *
   * Absent when the person has chosen nothing, which is what leaves the
   * browser's remembered preference — and then the app default — deciding.
   */
  readonly language?: string
  readonly isUnrestricted?: boolean
  readonly groups?: readonly string[]
  /**
   * Effective roles for page access decisions: the user's Better Auth
   * `role` overlaid with every distinct role they hold in
   * `system.user_access` rows. Mirrors the `effectiveRoles` overlay used by
   * the table-level row-level-guard (`src/presentation/api/routes/tables/
   * row-level-guard.ts`). Used by `checkPageAccess` so a user who has the
   * Better Auth role `member` but holds `role: 'engineer'` in `user_access`
   * passes an `access: ['engineer']` page guard.
   *
   * Optional for backward compatibility — when absent, page access falls
   * back to checking `role` only.
   *
   * Bug 2.
   */
  readonly effectiveRoles?: readonly string[]
}
