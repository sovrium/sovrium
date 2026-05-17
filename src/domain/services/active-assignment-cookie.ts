/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Active-assignment cookie contract (US-AUTH-ACTIVE-SCOPE-SESSION, P-6).
 *
 * Two presentation-layer surfaces depend on this contract:
 *   1. `src/presentation/api/routes/active-scope.ts` — the HTTP API
 *      that sets/reads/clears the cookie.
 *   2. `src/presentation/rendering/current-user-resolver.ts` — the SSR
 *      `$currentUser.activeAssignment` resolver that consumes it.
 *
 * The cookie name is part of the network-visible contract (e.g. spec
 * tests assert it directly, and the picker UI in user code may want to
 * read it client-side). Keeping the name + the validation predicate in
 * one pure module:
 *
 *   - prevents the two surfaces from drifting (one renamed, the other
 *     not — silently broken active-assignment resolution),
 *   - lets each surface stay layer-correct (api ↛ rendering, rendering
 *     ↛ api) without owning the contract from a layer-specific home,
 *   - gives the next P-5 (`scoped-sidebar.spec.ts`) a single import
 *     site if the sidebar needs to read the cookie name.
 *
 * Everything in this module is a pure function — no I/O, no Hono types,
 * no infrastructure. The active-assignment lookup against `user_access`
 * still happens at the call site (it's a database read).
 */

/**
 * Cookie-name prefix for per-scope active assignments.
 * Pattern: `sovrium_active_assignment_<tableSlug>`.
 *
 * One cookie per scope table so cross-scope active assignments stay
 * independent (a user may be acting on `clients/c1` and `projects/p3`
 * simultaneously).
 */
export const ACTIVE_ASSIGNMENT_COOKIE_PREFIX = 'sovrium_active_assignment_'

/**
 * Build the cookie name for a given scope-table slug.
 */
export const cookieNameForScope = (tableSlug: string): string =>
  `${ACTIVE_ASSIGNMENT_COOKIE_PREFIX}${tableSlug}`

/**
 * Extract the scope-table slug embedded in an
 * `sovrium_active_assignment_*` cookie name. Returns `undefined` when
 * the name does not match the prefix or has an empty slug suffix.
 */
export const slugFromCookieName = (name: string): string | undefined => {
  if (!name.startsWith(ACTIVE_ASSIGNMENT_COOKIE_PREFIX)) return undefined
  const slug = name.slice(ACTIVE_ASSIGNMENT_COOKIE_PREFIX.length)
  return slug.length === 0 ? undefined : slug
}

/**
 * Pick the slugs to walk for `activeAssignment` resolution.
 *
 * Prefers `auth.scopeTables` (deterministic declaration order) when
 * available, but falls back to slugs derived from cookie names so
 * legacy callers without `scopeTables` still get a result. The cookie
 * fallback is intentional defense-in-depth: if `scopeTables` is somehow
 * unavailable (older callers, partial config), the resolver still does
 * something sensible rather than dropping all active assignments.
 */
export const pickCandidateSlugs = (
  scopeTables: readonly string[] | undefined,
  cookieNames: readonly string[]
): readonly string[] => {
  if (scopeTables && scopeTables.length > 0) return scopeTables
  return cookieNames
    .map((name) => slugFromCookieName(name))
    .filter((slug): slug is string => slug !== undefined)
}

/**
 * Validate a cookie value against the user's accessible record-ids for
 * a single scope. Returns the validated recordId on success, or
 * `undefined` when the cookie is missing or tampered.
 *
 * Pure function — the caller is responsible for fetching the
 * accessible record-ids from `user_access`.
 */
export const validateActiveAssignment = (
  cookieValue: string | undefined,
  accessibleRecordIds: readonly string[]
): string | undefined => {
  if (cookieValue === undefined) return undefined
  return accessibleRecordIds.includes(cookieValue) ? cookieValue : undefined
}

/**
 * Resolve the active-assignment recordId for a single scope: validate
 * the cookie value, and on tamper / absence fall back to the first
 * accessible record. Returns `''` when no fallback is available so
 * downstream filter equality keeps producing zero rows rather than
 * crashing.
 *
 * This is the SSR-side recovery path. The API-side handlers do NOT
 * use this: they return `null` on tamper instead of silently swapping
 * in the fallback (the SSR contract is "always render something
 * sensible"; the API contract is "tell the client when the cookie is
 * invalid").
 */
export const resolveActiveAssignmentForScope = (
  cookieValue: string | undefined,
  accessibleRecordIds: readonly string[]
): string => {
  const validated = validateActiveAssignment(cookieValue, accessibleRecordIds)
  if (validated !== undefined) return validated
  return accessibleRecordIds[0] ?? ''
}
