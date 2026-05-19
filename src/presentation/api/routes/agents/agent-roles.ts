/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'

export const BUILT_IN_ROLE_LEVELS: Readonly<Record<string, number>> = {
  admin: 80,
  member: 40,
  viewer: 10,
}

export const resolveRoleLevel = (app: App | undefined, roleName: string): number => {
  const declared = app?.auth?.roles?.find((role) => role.name === roleName)
  if (declared?.level !== undefined) return declared.level
  return BUILT_IN_ROLE_LEVELS[roleName] ?? 0
}
