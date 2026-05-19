/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const ACTIVE_ASSIGNMENT_COOKIE_PREFIX = 'sovrium_active_assignment_'

export const cookieNameForScope = (tableSlug: string): string =>
  `${ACTIVE_ASSIGNMENT_COOKIE_PREFIX}${tableSlug}`

export const slugFromCookieName = (name: string): string | undefined => {
  if (!name.startsWith(ACTIVE_ASSIGNMENT_COOKIE_PREFIX)) return undefined
  const slug = name.slice(ACTIVE_ASSIGNMENT_COOKIE_PREFIX.length)
  return slug.length === 0 ? undefined : slug
}

export const pickCandidateSlugs = (
  scopeTables: readonly string[] | undefined,
  cookieNames: readonly string[]
): readonly string[] => {
  if (scopeTables && scopeTables.length > 0) return scopeTables
  return cookieNames
    .map((name) => slugFromCookieName(name))
    .filter((slug): slug is string => slug !== undefined)
}

export const validateActiveAssignment = (
  cookieValue: string | undefined,
  accessibleRecordIds: readonly string[]
): string | undefined => {
  if (cookieValue === undefined) return undefined
  return accessibleRecordIds.includes(cookieValue) ? cookieValue : undefined
}

export const resolveActiveAssignmentForScope = (
  cookieValue: string | undefined,
  accessibleRecordIds: readonly string[]
): string => {
  const validated = validateActiveAssignment(cookieValue, accessibleRecordIds)
  if (validated !== undefined) return validated
  return accessibleRecordIds[0] ?? ''
}
