/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { RoleDefinition } from '@/domain/models/app/auth/roles'
import type { SessionInfo } from '@/domain/types/session-info'


const ASSIGNMENT_TOKEN_PATTERN = /\$currentUser\.assignments\.([a-z][a-z0-9_-]*)\[0\]/

function extractAssignmentTable(defaultLanding: string): string | undefined {
  const match = defaultLanding.match(ASSIGNMENT_TOKEN_PATTERN)
  return match?.[1]
}

function substituteAssignment(defaultLanding: string, recordId: string): string {
  return defaultLanding.replace(ASSIGNMENT_TOKEN_PATTERN, encodeURIComponent(recordId))
}

type RoleResolution = { readonly kind: 'match'; readonly url: string } | { readonly kind: 'skip' }

async function resolveRole(
  role: RoleDefinition,
  session: SessionInfo,
  fetchAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>
): Promise<RoleResolution> {
  if (!role.defaultLanding) return { kind: 'skip' }

  const table = extractAssignmentTable(role.defaultLanding)

  if (table === undefined) {
    return session.isUnrestricted === true
      ? { kind: 'match', url: role.defaultLanding }
      : { kind: 'skip' }
  }

  const assignments = await fetchAssignments(session.userId, table)
  if (assignments.length === 1) {
    return { kind: 'match', url: substituteAssignment(role.defaultLanding, assignments[0]!) }
  }
  if (assignments.length > 1 && role.pickerLanding) {
    return { kind: 'match', url: role.pickerLanding }
  }
  return { kind: 'skip' }
}

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

export async function resolveLandingPath(
  app: App,
  session: SessionInfo,
  fetchAssignments: (userId: string, tableSlug: string) => Promise<readonly string[]>
): Promise<string> {
  const roles = app.auth?.roles ?? []
  const matched = await firstMatchingUrl(roles, 0, session, fetchAssignments)
  return matched ?? app.auth?.noAccessPath ?? '/403'
}
