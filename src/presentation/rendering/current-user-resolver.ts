/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  cookieNameForScope,
  pickCandidateSlugs,
  resolveActiveAssignmentForScope,
} from '@/domain/services/active-assignment-cookie'
import { normalizeCurrentUserRef } from '@/domain/utils/current-user-ref'
import type { CurrentUserRef, DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * `$currentUser.activeAssignment` resolver — see
 * `domain/services/active-assignment-cookie.ts` for the cookie-name
 * contract and the pure validation/fallback predicates this file
 * composes.
 *
 * The resolver scans the configured `auth.scopeTables` (or, when
 * unavailable, falls back to scanning cookie names):
 *   1. For each candidate slug, read the
 *      `sovrium_active_assignment_<slug>` cookie value (if any).
 *   2. Validate the value against the user's `user_access` rows; on
 *      success the value wins.
 *   3. On tamper / absence, fall back to the first accessible record
 *      from `user_access` for that slug.
 *
 * Server-side validation defeats cookie tampering: a malicious cookie
 * pointing at a record outside the user's `user_access` is silently
 * discarded.
 *
 * Apps that need scope-specific resolution should use
 * `$currentUser.assignments.<table>` instead — that path does not honour
 * the active-scope cookie.
 */

export type CurrentUserResolutionContext = {
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly fetchAssignments?: (userId: string, tableSlug: string) => Promise<readonly string[]>
  /**
   * Scope-table slugs declared in `auth.scopeTables`. Required for the
   * `$currentUser.activeAssignment` resolver so cookie values can be
   * validated against the configured scope set (defends against
   * tampered cookies pointing at slugs the app does not declare).
   *
   * Optional for backward compatibility — when omitted, the resolver
   * falls back to a best-effort cookie scan. New callers (P-6) should
   * always pass this.
   */
  readonly scopeTables?: readonly string[]
}

/**
 * Discriminated outcome of resolving a single filter.
 *
 * - `ok` : the filter is resolved (or the value contains no $currentUser ref)
 * - `unauthorized` : a `$currentUser` ref was encountered without a session.
 *   The page route should respond 401 — see Z-1 §0.1 #3 in
 *   docs/customers/sovrium-services.md.
 * - `bypass` : the user is unrestricted (Better Auth admin) and the filter
 *   uses an assignments-based scope. The filter is dropped entirely so the
 *   data source returns all records.
 */
export type FilterResolution =
  | { readonly kind: 'ok'; readonly filter: DataFilter }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'bypass' }

/**
 * Resolves a single filter's `value` if it contains a `$currentUser`
 * reference. Returns the filter unchanged when the value is a plain
 * literal.
 */
export const resolveFilter = async (
  filter: DataFilter,
  ctx: CurrentUserResolutionContext
): Promise<FilterResolution> => {
  const ref = normalizeCurrentUserRef(filter.value)
  if (!ref) return { kind: 'ok', filter }

  // Defense-in-depth: any $currentUser reference REQUIRES a session.
  if (!ctx.session) return { kind: 'unauthorized' }

  // Unrestricted bypass — global admins see all records that an assignment
  // filter would otherwise scope.
  if (ctx.session.isUnrestricted && isAssignmentRef(ref)) return { kind: 'bypass' }

  const resolved = await resolveRef(ref, ctx)
  return { kind: 'ok', filter: { ...filter, value: resolved } }
}

/**
 * Resolves an array of filters. Short-circuits on the first
 * `unauthorized` result.
 *
 * Returns either:
 * - `{ kind: 'ok', filter: DataFilter[] }` with bypassed filters dropped
 * - `{ kind: 'unauthorized' }` if any $currentUser ref was hit without auth
 */
export type FiltersResolution =
  | { readonly kind: 'ok'; readonly filter: readonly DataFilter[] }
  | { readonly kind: 'unauthorized' }

export const resolveFilters = async (
  filters: readonly DataFilter[] | undefined,
  ctx: CurrentUserResolutionContext
): Promise<FiltersResolution> => {
  if (!filters || filters.length === 0) return { kind: 'ok', filter: filters ?? [] }

  const resolutions = await Promise.all(filters.map((f) => resolveFilter(f, ctx)))
  if (resolutions.some((r) => r.kind === 'unauthorized')) return { kind: 'unauthorized' }

  const ok = resolutions
    .filter((r): r is { kind: 'ok'; filter: DataFilter } => r.kind === 'ok')
    .map((r) => r.filter)
  return { kind: 'ok', filter: ok }
}

/**
 * Returns true when at least one filter contains a `$currentUser` reference
 * (in either object or string-template form).
 */
export const hasCurrentUserRef = (filters: readonly DataFilter[] | undefined): boolean => {
  if (!filters || filters.length === 0) return false
  return filters.some((f) => normalizeCurrentUserRef(f.value) !== undefined)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const isAssignmentRef = (ref: CurrentUserRef): boolean =>
  ref.path.kind === 'assignment' || ref.path.kind === 'activeAssignment'

const resolveRef = async (
  ref: CurrentUserRef,
  ctx: CurrentUserResolutionContext
): Promise<string | number | boolean | readonly string[]> => {
  const session = ctx.session!

  if (ref.path.kind === 'scalar') {
    return resolveScalar(ref.path.name, session)
  }

  if (ref.path.kind === 'assignment') {
    if (!ctx.fetchAssignments) return [] as readonly string[]
    return ctx.fetchAssignments(session.userId, ref.path.tableSlug)
  }

  // activeAssignment — read the active-scope cookie set by P-6 with
  // server-side validation and tamper-resistant fallback.
  return resolveActiveAssignment(session.userId, ctx)
}

const resolveScalar = (
  name: 'id' | 'email' | 'role' | 'isUnrestricted',
  session: SessionInfo
): string | boolean => {
  if (name === 'id') return session.userId
  if (name === 'email') return session.email ?? ''
  if (name === 'role') return session.role
  return session.isUnrestricted === true
}

/**
 * Resolve the active-assignment recordId for the current user.
 *
 * Walks the candidate scope-table slugs (deterministic declaration order
 * from `auth.scopeTables`, or cookie-derived fallback) and returns the
 * first slug whose validation chain produces a valid recordId.
 *
 * For each candidate slug:
 *   - If the cookie value is present AND included in the user's
 *     `user_access.record_ids`, return it (happy path).
 *   - Otherwise, return the first accessible record_id (fallback).
 *
 * Returns `''` when no scope yields a valid recordId — keeps downstream
 * filter equality checks producing zero rows rather than crashing.
 */
const resolveActiveAssignment = async (
  userId: string,
  ctx: CurrentUserResolutionContext
): Promise<string> => {
  const cookies = ctx.cookies ?? {}
  const { fetchAssignments } = ctx

  const candidateSlugs = pickCandidateSlugs(ctx.scopeTables, Object.keys(cookies))

  // Walk slugs in declaration order; first valid recordId wins.
  // We iterate sequentially (Promise reduce) rather than parallel because
  // we usually only have one or two scope tables and a serial walk reads
  // the simplest under the no-mutable-loops rule.
  return candidateSlugs.reduce<Promise<string>>(async (accPromise, slug) => {
    const acc = await accPromise
    if (acc !== '') return acc

    const cookieValue = cookies[cookieNameForScope(slug)]
    if (!fetchAssignments) {
      // No way to validate — fall back to cookie value verbatim. This is
      // the legacy behaviour for callers that did not pass `fetchAssignments`.
      return cookieValue ?? ''
    }

    const accessible = await fetchAssignments(userId, slug)
    return resolveActiveAssignmentForScope(cookieValue, accessible)
  }, Promise.resolve(''))
}
