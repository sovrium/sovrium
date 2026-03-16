/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { PageAccess } from '@/domain/models/app/page/access'

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
 * Checks if session satisfies the access requirement
 */
function isSessionAuthorized(
  require: 'authenticated' | readonly string[],
  session: SessionInfo
): boolean {
  if (require === 'authenticated') return true
  return Array.isArray(require) && require.includes(session.role)
}

/**
 * Builds the denial response for unauthorized access
 */
function denyAccess(redirectTo: string | undefined): AccessDecision {
  return redirectTo
    ? { allowed: false, action: 'redirect', url: redirectTo }
    : { allowed: false, action: 'not-found' }
}

/**
 * Pure function that determines whether a page should be accessible
 *
 * Checks access control rules against the optional session info.
 * When session is provided, authenticated/role-based access is evaluated.
 * When session is absent, auth-requiring pages are denied.
 */
export function checkPageAccess(
  access: PageAccess | undefined,
  app: App,
  session?: SessionInfo
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

  return denyAccess(normalized.redirectTo)
}
