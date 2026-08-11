/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { admin } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Admin plugin configuration extracted from auth config.
 *
 * Only `defaultRole` is configurable. Two former fields were removed in the
 * round-4 audit because both were inert:
 *
 * - `firstUserAdmin: true` was never read. It does not exist in Better Auth
 *   (0 occurrences in the vendored source); upstream assigns
 *   `role: defaultRole ?? 'user'` to every sign-up unconditionally. The first
 *   registrant has never become an admin. A user reaches `role='admin'` only
 *   via `bootstrapAdmin` (`AUTH_ADMIN_EMAIL`/`AUTH_ADMIN_PASSWORD`), an
 *   existing admin calling `POST /admin/set-role`, or a direct DB write.
 * - `impersonation: false` only chose between
 *   `impersonationSessionDuration: undefined` and `60 * 60`, and upstream
 *   already defaults an absent duration to one hour — so both branches were the
 *   same behaviour. It never disabled impersonation. A boolean named
 *   `impersonation` that does not disable impersonation is worse than no field
 *   at all, so it is gone rather than "fixed": impersonation IS always on when
 *   auth is configured, and `admin-user-management.md` documents it as such.
 */
export interface AdminPluginConfig {
  readonly defaultRole: string
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
 *
 * `adminRoles` stays pinned to `['admin']`: widening it THROWS at plugin
 * construction unless every name is also a key of a supplied `roles` map
 * (vendored `admin.ts:54-69`), and supplying `roles` REPLACES Better Auth's
 * default permission set. Sovrium's own admin-tier roles are therefore admitted
 * by `applyAdminRoleCheckMiddleware` / `isAdminTier`, not by this option.
 */
export const buildAdminPlugin = (authConfig?: Auth) => {
  const config = parseAdminConfig(authConfig)
  if (!config) return []

  return [
    admin({
      defaultRole: config.defaultRole,
      adminRoles: ['admin'],
    }),
  ]
}
