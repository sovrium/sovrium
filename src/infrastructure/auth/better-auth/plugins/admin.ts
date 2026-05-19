/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { admin } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

export interface AdminPluginConfig {
  readonly defaultRole: string
  readonly firstUserAdmin: boolean
  readonly impersonation: boolean
}

export const parseAdminConfig = (authConfig?: Auth): AdminPluginConfig | undefined => {
  if (!authConfig) return undefined

  return {
    defaultRole: authConfig.defaultRole ?? 'member',
    firstUserAdmin: true,
    impersonation: false,
  }
}

export const buildAdminPlugin = (authConfig?: Auth) => {
  const config = parseAdminConfig(authConfig)
  if (!config) return []

  return [
    admin({
      defaultRole: config.defaultRole,
      adminRoles: ['admin'],
      impersonationSessionDuration: config.impersonation ? 60 * 60 : undefined,
    }),
  ]
}
