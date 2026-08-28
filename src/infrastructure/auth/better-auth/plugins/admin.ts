/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { admin } from 'better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { assignableRoleNames, isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { Auth } from '@/domain/models/app/auth'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

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
 * The access-control map handed to Better Auth's `roles` option — Sovrium's own
 * role vocabulary, projected onto the vendored plugin's permission model.
 *
 * WHY THIS EXISTS. `hasPermission` (vendored `admin/has-permission.ts:21-24`)
 * resolves the caller's permissions with `acRoles = options.roles ||
 * defaultRoles`, and `defaultRoles` has exactly two keys, `admin` and `user`.
 * An app whose top operator role is named anything else — `apps/partner` ships
 * `engineer` — therefore looked up `acRoles['engineer']`, got `undefined`, and
 * every handler on the plane answered **403**: `list-users`, `set-role`,
 * `ban-user`, `create-user`, `impersonate-user`. That 403 fired one layer
 * BEHIND Sovrium's own gate, which admits the same caller via
 * `isAdminEquivalent` (`auth-routes.ts`), so a deployed app's own bootstrap
 * admin passed the door and was refused by the room.
 *
 * KEYED ON `assignableRoleNames`, NOT ON A HAND-WRITTEN LIST. Supplying `roles`
 * also arms two vendored validity checks that are inert while it is absent —
 * `set-role` (`routes.ts:142-155`) and `create-user` (`routes.ts:381-387`) both
 * reject a role that is not a key of the map. Keying the map on the SAME set
 * `validateAssignableRole` accepts (`admin-role-guards.ts`) is what stops those
 * checks contradicting Sovrium's own 400: the two vocabularies are now the same
 * set by construction rather than by coincidence.
 *
 * GRANTS NOTHING THE DEFAULTS DID NOT. The values are the vendored `adminAc` and
 * `userAc` objects themselves — the very two that compose `defaultRoles` — never
 * a re-declared permission set. So per role the map is a strict projection of
 * the shipped defaults:
 *
 *   - `isAdminEquivalent` → `adminAc`, which IS `defaultRoles.admin` by reference
 *     (asserted in the co-located test, so a Better Auth bump that changes the
 *     admin grant is inherited rather than silently diverged from);
 *   - everything else → `userAc` (empty), which `authorize()` refuses exactly as
 *     the previous `undefined` lookup did.
 *
 * The one role whose grant can NARROW is the built-in `admin` in an app that
 * declares a custom role above level 80, where `isAdminEquivalent('admin', app)`
 * is false. That is unobservable: `applyAdminRoleCheckMiddleware` already 404s
 * that caller on the same predicate, so the door is shut before the permission
 * is ever read. Aligning the inner map onto the outer gate's predicate is the
 * whole point — the plugin can no longer disagree with Sovrium about who is an
 * admin.
 *
 * `impersonate-admins` is absent from `adminAc` upstream and stays absent here,
 * so the vendored impersonation-of-admins refusal is untouched.
 */
export const buildRolePermissions = (app: AdminRoleResolvable) =>
  Object.fromEntries(
    [...assignableRoleNames(app)].map((name) => [
      name,
      isAdminEquivalent(name, app) ? adminAc : userAc,
    ])
  )

/**
 * Build admin plugin if auth is configured
 *
 * The admin plugin provides:
 * - User management (list, ban, unban, impersonate)
 * - Role-based access control over {@link buildRolePermissions}
 *
 * Admin features are always enabled when auth is configured — no separate toggle.
 *
 * `adminRoles` stays pinned to `['admin']`, deliberately, and it is NOT the
 * option that fixes the caller path. It is read in exactly one place at runtime
 * (vendored `routes.ts:1240-1251`), the impersonation TARGET guard, and never
 * feeds the caller check — so widening it would not have admitted `engineer` to
 * a single endpoint. Its only other role is a construction-time assertion that
 * every name in it is a key of `roles`, which `assignableRoleNames` satisfies
 * because `BUILT_IN_ROLES` always contributes `admin`. Sovrium's own
 * `guardImpersonationTarget` (`admin-role-guards.ts`) already refuses every
 * `isAdminTier` target from a `before` hook — a strictly wider set, running
 * strictly earlier — so widening `adminRoles` would add a second, narrower copy
 * of a rail that already holds.
 */
export const buildAdminPlugin = (authConfig?: Auth) => {
  const config = parseAdminConfig(authConfig)
  if (!config) return []

  return [
    admin({
      defaultRole: config.defaultRole,
      adminRoles: ['admin'],
      roles: buildRolePermissions({ auth: authConfig }),
    }),
  ]
}
