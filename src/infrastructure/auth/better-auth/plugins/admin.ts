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
 *
 * Admin features are always enabled when auth is configured.
 * Uses `defaultRole` from auth config (defaults to 'member').
 */
export const parseAdminConfig = (authConfig?: Auth): AdminPluginConfig | undefined => {
  if (!authConfig) return undefined

  return {
    defaultRole: authConfig.defaultRole ?? 'member',
    firstUserAdmin: true,
    impersonation: false,
  }
}

/**
 * Build admin plugin if auth is configured
 *
 * The admin plugin provides:
 * - User management (list, ban, unban, impersonate)
 * - Role-based access control (admin, member, viewer roles)
 *
 * Admin features are always enabled when auth is configured — no separate toggle.
 */
export const buildAdminPlugin = (authConfig?: Auth) => {
  const config = parseAdminConfig(authConfig)
  if (!config) return []

  return [
    admin({
      defaultRole: config.defaultRole,
      adminRoles: ['admin'],
      impersonationSessionDuration: config.impersonation ? 60 * 60 : undefined,
      firstUserAdmin: config.firstUserAdmin,
    }),
  ]
}
