/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { RoleDefinition } from '@/domain/models/app/auth/roles'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * Per-role landing-resolver decision (US-AUTH-POST-LOGIN-LANDING).
 *
 * When a session navigates to `auth.landingPath`, the engine walks
 * `auth.roles[]` in declaration order and returns the first role that
 * resolves to a redirect target:
 *
 * - **Bare URL `defaultLanding`** (no `$currentUser.assignments.<table>[0]`
 *   token): matches when the session is unrestricted (Better Auth admin).
 * - **Templated `defaultLanding`**: matches based on assignment count for
 *   the templated table:
 *   - exactly one assignment → substitute the token with the record id
 *   - more than one AND `pickerLanding` is set → redirect to `pickerLanding`
 *   - otherwise → continue to the next role.
 *
 * Falls through to `auth.noAccessPath` (default `/403`) when no role matches.
 *
 * Cross-feature note (US-AUTH-ACTIVE-SCOPE-SESSION, P-6): the active-scope
 * session feature also needs a "single vs multi assignment per scope"
 * computation, but its inputs are different (cookie-bound active assignment
 * vs declaration-order role walk). The two resolvers should remain
 * independent until a third caller appears with overlapping needs — that
 * is when extracting a shared `assignmentCounts(session)` primitive will
 * pay back the indirection.
 */

const ASSIGNMENT_TOKEN_PATTERN = /\$currentUser\.assignments\.([a-z][a-z0-9_-]*)\[0\]/

/**
 * Extracts the templated `<table>` from a `defaultLanding` URL, or
 * returns `undefined` when the URL is a bare path.
 */
function extractAssignmentTable(defaultLanding: string): string | undefined {
  const match = defaultLanding.match(ASSIGNMENT_TOKEN_PATTERN)
  return match?.[1]
}

/**
 * Substitutes the single assignment token in `defaultLanding` with
 * the supplied record id. The encode step keeps slashes literal so
 * the resulting URL stays a normal path, while still escaping any
 * unusual id characters.
 */
function substituteAssignment(defaultLanding: string, recordId: string): string {
  return defaultLanding.replace(ASSIGNMENT_TOKEN_PATTERN, encodeURIComponent(recordId))
}

/**
 * Per-role resolution outcome — `match` returns the redirect URL, `skip`
 * tells the caller to advance to the next role.
 */
type RoleResolution = { readonly kind: 'match'; readonly url: string } | { readonly kind: 'skip' }

async function resolveRole(
  role: RoleDefinition,
  session: SessionInfo,
  fetchAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>
): Promise<RoleResolution> {
  if (!role.defaultLanding) return { kind: 'skip' }

  const table = extractAssignmentTable(role.defaultLanding)

  // Bare URL — only matches global admins (the unconditional case).
  if (table === undefined) {
    return session.isUnrestricted === true
      ? { kind: 'match', url: role.defaultLanding }
      : { kind: 'skip' }
  }

  // Templated URL — count this user's assignments for the templated scope.
  const assignments = await fetchAssignments(session.userId, table)
  if (assignments.length === 1) {
    return { kind: 'match', url: substituteAssignment(role.defaultLanding, assignments[0]!) }
  }
  if (assignments.length > 1 && role.pickerLanding) {
    return { kind: 'match', url: role.pickerLanding }
  }
  return { kind: 'skip' }
}

/**
 * Sequentially walks `roles` and returns the URL of the first matching
 * role, or `undefined` when none matches. Implemented as a recursive
 * reducer so the project's no-mutable-loops rule holds while still
 * short-circuiting on the first match (vs. mapping the whole array).
 */
async function firstMatchingUrl(
  roles: readonly RoleDefinition[],
  index: number,
  session: SessionInfo,
  fetchAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>
): Promise<string | undefined> {
  if (index >= roles.length) return undefined
  const result = await resolveRole(roles[index]!, session, fetchAssignments)
  if (result.kind === 'match') return result.url
  return firstMatchingUrl(roles, index + 1, session, fetchAssignments)
}

/**
 * Resolves the appropriate landing URL for an authenticated session
 * navigating to `auth.landingPath`. Returns the redirect target as a
 * string (always defined — falls through to `noAccessPath` when no
 * role matches).
 *
 * Pure aside from the injected async `fetchAssignments` callback.
 */
export async function resolveLandingPath(
  app: App,
  session: SessionInfo,
  fetchAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>
): Promise<string> {
  const roles = app.auth?.roles ?? []
  const matched = await firstMatchingUrl(roles, 0, session, fetchAssignments)
  return matched ?? app.auth?.noAccessPath ?? '/403'
}
