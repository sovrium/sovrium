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
import type { App } from '@/domain/models/app'
import type { PageAccess } from '@/domain/models/app/pages/access'
import type { SessionInfo } from '@/domain/types/session-info'

export type AccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly action: 'not-found' }
  | { readonly allowed: false; readonly action: 'redirect'; readonly url: string }
  | { readonly allowed: false; readonly action: 'error'; readonly message: string }

interface NormalizedAccess {
  readonly require: 'all' | 'authenticated' | readonly string[]
  readonly redirectTo: string | undefined
}

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
  const extended = access as {
    readonly require: 'all' | 'authenticated' | readonly string[]
    readonly redirectTo?: string
  }
  return {
    require: extended.require,
    redirectTo: extended.redirectTo,
  }
}

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

function isSessionAuthorized(
  require: 'authenticated' | readonly string[],
  session: SessionInfo
): boolean {
  if (require === 'authenticated') return true
  if (session.isUnrestricted === true) return true
  if (!Array.isArray(require)) return false

  const { roles, groups } = splitGroupReferences(require)

  if (roles.includes(session.role)) return true

  const effective = session.effectiveRoles ?? []
  if (effective.some((effRole) => roles.includes(effRole))) return true

  const userGroups = session.groups ?? []
  return groups.some((groupName) => userGroups.includes(groupName))
}

function withReturnPath(redirectTo: string, currentPath: string | undefined): string {
  if (!currentPath || currentPath === redirectTo) return redirectTo
  const separator = redirectTo.includes('?') ? '&' : '?'
  return `${redirectTo}${separator}redirect=${encodeURIComponent(currentPath)}`
}

function denyAccess(
  redirectTo: string | undefined,
  currentPath: string | undefined
): AccessDecision {
  return redirectTo
    ? { allowed: false, action: 'redirect', url: withReturnPath(redirectTo, currentPath) }
    : { allowed: false, action: 'not-found' }
}

export function checkPageAccess(
  access: PageAccess | undefined,
  app: App,
  session?: SessionInfo,
  currentPath?: string
): AccessDecision {
  const normalized = normalizeAccess(access)

  if (normalized.require === 'all') {
    return { allowed: true }
  }

  if (!app.auth) {
    return {
      allowed: false,
      action: 'error',
      message: 'Error: auth must be configured to use access control',
    }
  }

  if (Array.isArray(normalized.require)) {
    const { roles, groups } = splitGroupReferences(normalized.require)
    const groupError = validateGroups(groups, app)
    if (groupError) return groupError
    const roleError = validateRoles(roles, app)
    if (roleError) return roleError
  }

  if (session && isSessionAuthorized(normalized.require, session)) {
    return { allowed: true }
  }

  return denyAccess(normalized.redirectTo, currentPath)
}
