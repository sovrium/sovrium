/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  splitGroupReferences,
  toGroupReference,
} from '@/domain/models/app/auth/groups/group-reference'
import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
import {
  isOpenToEveryone,
  requiresOnlyASession,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'
import type { App } from '@/domain/models/app'
import type { PageAccess } from '@/domain/models/app/pages/access'
import type { SessionInfo } from '@/domain/types/session-info'

/**
 * Result of a page access check
 */
export type AccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly action: 'not-found' }
  | { readonly allowed: false; readonly action: 'redirect'; readonly url: string }
  | { readonly allowed: false; readonly action: 'error'; readonly message: string }

/**
 * Normalized access requirement extracted from all PageAccess formats
 */
interface NormalizedAccess {
  readonly require: 'all' | 'authenticated' | readonly string[]
  readonly redirectTo: string | undefined
}

/**
 * Normalizes all PageAccess formats into a uniform structure
 */
function normalizeAccess(access: PageAccess | undefined): NormalizedAccess {
  if (access === undefined || isOpenToEveryone(toPermissionValue(access))) {
    return { require: 'all', redirectTo: undefined }
  }
  if (requiresOnlyASession(toPermissionValue(access))) {
    return { require: 'authenticated', redirectTo: undefined }
  }
  if (Array.isArray(access)) {
    return { require: access, redirectTo: undefined }
  }
  // Extended format: { require, redirectTo }
  const extended = access as {
    readonly require: 'all' | 'authenticated' | readonly string[]
    readonly redirectTo?: string
  }
  return {
    require: extended.require,
    redirectTo: extended.redirectTo,
  }
}

/**
 * Validates that all role names in a role-based access requirement exist
 * Returns an error decision if unknown roles are found, undefined otherwise
 */
function validateRoles(roles: readonly string[], app: App): AccessDecision | undefined {
  const customRoleNames = app.auth?.roles?.map((r) => r.name) ?? []
  const allValidRoles = new Set([...BUILT_IN_ROLES, ...customRoleNames])
  const unknownRoles = roles.filter((role) => !allValidRoles.has(role))

  if (unknownRoles.length > 0) {
    return {
      allowed: false,
      action: 'error',
      message: `Error: unknown role(s): ${unknownRoles.join(', ')}`,
    }
  }
  return undefined
}

/**
 * Validates that all `group:<name>` references in an access array point to
 * groups declared in `app.auth.groups`. Returns an error decision when an
 * undefined group is referenced, undefined otherwise.
 */
function validateGroups(groups: readonly string[], app: App): AccessDecision | undefined {
  const definedGroups = new Set(app.auth?.groups?.map((g) => g.name) ?? [])
  const unknownGroups = groups.filter((name) => !definedGroups.has(name))

  if (unknownGroups.length > 0) {
    return {
      allowed: false,
      action: 'error',
      message: `Error: page access references undefined group(s): ${unknownGroups
        .map(toGroupReference)
        .join(', ')}`,
    }
  }
  return undefined
}

/**
 * Checks if session satisfies the access requirement.
 *
 * Better Auth admins ("global admins" with `session.isUnrestricted === true`)
 * bypass role-based page-access checks: an unrestricted admin reaches every
 * role-gated page regardless of the listed roles. This mirrors the
 * `$currentUser.isUnrestricted` data bypass and the landing resolver, whose
 * bare-`defaultLanding` arm matches ONLY unrestricted admins — so a
 * `role-landing` login that routes an admin to an `access: ['engineer']` page
 * must also render it, not 404.
 */
function isSessionAuthorized(
  require: 'authenticated' | readonly string[],
  session: SessionInfo
): boolean {
  if (requiresOnlyASession(require)) return true
  // Global admins (Better Auth `isUnrestricted`) bypass role-based gates.
  if (session.isUnrestricted === true) return true
  if (!Array.isArray(require)) return false

  const { roles, groups } = splitGroupReferences(require)

  // Role match — the user's global role is listed in the access array.
  if (roles.includes(session.role)) return true

  // Bug 2: consult the user_access overlay
  // roles. Mirrors the table-level Z-3 pattern (row-level-guard's
  // `effectiveRoles = mergeRoles(userRole, userAccessRoles)`). A user with
  // Better Auth role `member` but a `system.user_access` row of
  // `role: 'engineer'` passes a page guard of `access: ['engineer']`.
  const effective = session.effectiveRoles ?? []
  if (effective.some((effRole) => roles.includes(effRole))) return true

  // Group match (most-permissive-wins) — the user belongs to any group
  // referenced via the `group:<name>` prefix.
  const userGroups = session.groups ?? []
  return groups.some((groupName) => userGroups.includes(groupName))
}

/**
 * Appends a `?redirect=<encoded path>` query parameter to a denial-redirect
 * URL so the login page can bounce the user back to the page they tried to
 * reach. Skipped when `currentPath` is missing or matches the redirect
 * target (avoids self-referential loops).
 *
 * Behavioral note: this is GLOBAL — every `access.redirectTo` denial gets
 * the return-path query, not just `auth.landingPath`. This is intentional:
 * (a) it is the natural meaning of "redirect to login" (preserve where
 * the user was going), and (b) existing `authenticated-pages` specs assert
 * `toHaveURL(/\/login/)` (loose match), so they keep passing. Pages that
 * pass `redirectTo` already opted into "bounce me to a page that should
 * know how to send me back"; the query param is the contract. Login pages
 * (or whatever the `redirectTo` target is) may consume `?redirect=` after
 * sign-in to navigate the user back.
 */
function withReturnPath(redirectTo: string, currentPath: string | undefined): string {
  if (!currentPath || currentPath === redirectTo) return redirectTo
  const separator = redirectTo.includes('?') ? '&' : '?'
  return `${redirectTo}${separator}redirect=${encodeURIComponent(currentPath)}`
}

/**
 * Builds the denial response for unauthorized access
 */
function denyAccess(
  redirectTo: string | undefined,
  currentPath: string | undefined
): AccessDecision {
  return redirectTo
    ? { allowed: false, action: 'redirect', url: withReturnPath(redirectTo, currentPath) }
    : { allowed: false, action: 'not-found' }
}

/**
 * Pure function that determines whether a page should be accessible
 *
 * Checks access control rules against the optional session info.
 * When session is provided, authenticated/role-based access is evaluated.
 * When session is absent, auth-requiring pages are denied.
 *
 * `currentPath` is the request path being evaluated; when provided and
 * the access rule produces a redirect, the original path is preserved
 * via a `?redirect=<encoded>` query parameter so the login page can
 * bounce the user back after sign-in.
 */
export function checkPageAccess(
  access: PageAccess | undefined,
  app: App,
  session?: SessionInfo,
  currentPath?: string
): AccessDecision {
  const normalized = normalizeAccess(access)

  // Public pages are always allowed
  if (isOpenToEveryone(normalized.require)) {
    return { allowed: true }
  }

  // Auth-requiring pages need auth to be configured
  if (!app.auth) {
    return {
      allowed: false,
      action: 'error',
      message: 'Error: auth must be configured to use access control',
    }
  }

  // Role-based access: validate that all roles AND group references exist.
  // `group:<name>` entries are validated against `app.auth.groups`; plain
  // entries against the built-in + custom role names.
  if (Array.isArray(normalized.require)) {
    const { roles, groups } = splitGroupReferences(normalized.require)
    const groupError = validateGroups(groups, app)
    if (groupError) return groupError
    const roleError = validateRoles(roles, app)
    if (roleError) return roleError
  }

  // Session-aware access check
  if (session && isSessionAuthorized(normalized.require, session)) {
    return { allowed: true }
  }

  return denyAccess(normalized.redirectTo, currentPath)
}
