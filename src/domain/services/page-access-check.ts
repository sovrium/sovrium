/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
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
  if (access === undefined || access === 'all') {
    return { require: 'all', redirectTo: undefined }
  }
  if (access === 'authenticated') {
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
 * Checks if session satisfies the access requirement.
 *
 * TODO(post-login-landing loose end #3): Better Auth admins ("global admins"
 * with `session.isUnrestricted === true`) currently fail role-based access
 * checks because this only inspects `session.role`. As a result, an
 * unrestricted admin visiting an `access: ['engineer']` page will 404
 * unless the admin happens to ALSO carry that role. APP-AUTH-LANDING-001
 * works because it asserts the URL only, not the response code. Fix:
 * short-circuit `isUnrestricted === true` to `true` here, ideally guarded
 * by an explicit `app.auth.adminRoles` allow-list so admin-bypass is
 * intentional. Out of scope for this audit pass.
 */
function isSessionAuthorized(
  require: 'authenticated' | readonly string[],
  session: SessionInfo
): boolean {
  if (require === 'authenticated') return true
  return Array.isArray(require) && require.includes(session.role)
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
 * bounce the user back after sign-in (US-AUTH-POST-LOGIN-LANDING-005).
 */
export function checkPageAccess(
  access: PageAccess | undefined,
  app: App,
  session?: SessionInfo,
  currentPath?: string
): AccessDecision {
  const normalized = normalizeAccess(access)

  // Public pages are always allowed
  if (normalized.require === 'all') {
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

  // Role-based access: validate that all roles exist
  if (Array.isArray(normalized.require)) {
    const roleError = validateRoles(normalized.require, app)
    if (roleError) return roleError
  }

  // Session-aware access check
  if (session && isSessionAuthorized(normalized.require, session)) {
    return { allowed: true }
  }

  return denyAccess(normalized.redirectTo, currentPath)
}
