/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getSessionFromCtx } from 'better-auth/api'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { logError } from '@/infrastructure/logging/logger'
import { notFoundError } from './auth-not-found'
import { sessionUserId, type AuthMiddlewareCtx } from './hook-context'
import { ensureOwnerMembership } from './org-team-seeder'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * The organisation plugin's CHANGING routes, as Better Auth names them (the
 * path without `/api/auth`). Sovrium's `delete-team` reaches Better Auth as
 * `remove-team`, so the guard sees the plugin's own names.
 *
 * Left out on purpose: every read (`list-*`, `get-*`, `has-permission`,
 * `check-slug`) and the routes where a caller acts on their own state
 * (`set-active`, `set-active-team`, `leave`, `accept-invitation`,
 * `reject-invitation`).
 */
export const ORGANIZATION_MUTATION_PATHS: ReadonlySet<string> = new Set([
  '/organization/create',
  '/organization/update',
  '/organization/delete',
  '/organization/invite-member',
  '/organization/cancel-invitation',
  '/organization/remove-member',
  '/organization/update-member-role',
  '/organization/create-team',
  '/organization/update-team',
  '/organization/remove-team',
  '/organization/add-team-member',
  '/organization/remove-team-member',
  '/organization/create-role',
  '/organization/update-role',
  '/organization/delete-role',
])

type UserLookup = {
  readonly internalAdapter?: {
    readonly findUserById: (id: string) => Promise<{ readonly role?: unknown } | null>
  }
}

/**
 * The account's role as stored now — never a cookie-cached copy. A failed read
 * is logged and answers no role, so the change is refused rather than let
 * through on a role nobody could read.
 */
const currentRole = async (ctx: AuthMiddlewareCtx, userId: string): Promise<string | undefined> => {
  const adapter = (ctx.context as UserLookup).internalAdapter
  const user = await adapter?.findUserById(userId).catch((error: unknown) => {
    logError('[organization-admin-guard] could not read the caller account role', error)
    return null
  })
  return typeof user?.role === 'string' ? user.role : undefined
}

/**
 * Keep every change to the app's organisation and its groups to administrators.
 *
 * Sovrium groups are Better Auth teams inside the app's single organisation,
 * and the plugin decides who may change — and who may read — them from the
 * ORGANISATION role (`auth_member.role`), a column that says nothing about who
 * administers the app. So the decision is taken here, from the account role:
 *
 * - a caller who is not admin-equivalent gets 404 on every changing route, the
 *   answer a route that does not exist gives (the same anti-enumeration answer
 *   as every other refused door), whatever their organisation role says; their
 *   reads are left to the plugin, untouched;
 * - an admin-equivalent caller is made the organisation's `owner` first, on
 *   every organisation route, reads included (idempotent: no write when they
 *   already are), so an administrator created after other accounts — or
 *   promoted later — reads and manages groups as well as the first one.
 *
 * No session: the route answers 401 on its own, so it is let through. An API
 * key carries no session here (see `applyApiKeyAdminPlaneGuard`, which runs
 * first), so a keyed request raises nothing.
 */
export async function applyOrganizationAdminGuard(
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  client: PortableDb | undefined
): Promise<void> {
  const path = ctx.path ?? ''
  if (!path.startsWith('/organization/')) return
  const changing = ORGANIZATION_MUTATION_PATHS.has(path)

  const session = await getSessionFromCtx(ctx, { disableRefresh: true })
  const userId = sessionUserId(session)
  if (userId === undefined) return

  const role = await currentRole(ctx, userId)
  if (role === undefined || !isAdminEquivalent(role, app)) {
    if (changing) throw notFoundError()
    return
  }
  // A hook set built with no client reads no row: it refuses instead.
  if (client === undefined) throw notFoundError()
  await ensureOwnerMembership(client, userId)
}
