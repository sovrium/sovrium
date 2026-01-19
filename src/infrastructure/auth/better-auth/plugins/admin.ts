/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { admin } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Admin plugin configuration extracted from auth config
 */
export interface AdminPluginConfig {
  readonly defaultRole: string
  readonly firstUserAdmin: boolean
  readonly impersonation: boolean
}

/**
 * Parse admin plugin configuration from auth config
 */
export const parseAdminConfig = (authConfig?: Auth): AdminPluginConfig | undefined => {
  if (!authConfig?.admin) return undefined

  const adminConfig = typeof authConfig.admin === 'boolean' ? {} : authConfig.admin
  return {
    defaultRole: adminConfig.defaultRole ?? 'user',
    firstUserAdmin: adminConfig.firstUserAdmin ?? true, // Default to true for easier testing
    impersonation: adminConfig.impersonation ?? false,
  }
}

/**
 * Build admin plugin if enabled in auth configuration
 *
 * The admin plugin provides:
 * - User management (list, ban, unban, impersonate)
 * - Role-based access control (admin, member, user roles)
 *
 * NOTE: Role assignment hooks are now handled via databaseHooks in auth.ts
 * because Better Auth's admin plugin doesn't support hooks in its options.
 */
export const buildAdminPlugin = (authConfig?: Auth) => {
  const config = parseAdminConfig(authConfig)
  if (!config) return []

  return [
    admin({
      defaultRole: config.defaultRole,
      adminRoles: ['admin'], // Users with 'admin' role can impersonate
      impersonationSessionDuration: config.impersonation ? 60 * 60 : undefined, // 1 hour in seconds if enabled
    }),
  ]
}
