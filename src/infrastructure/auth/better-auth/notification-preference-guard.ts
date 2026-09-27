/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError, getSessionFromCtx } from 'better-auth/api'
import { isAdminTier } from '@/domain/models/app/auth/roles/role'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import type { createAuthMiddleware } from 'better-auth/api'

/**
 * The Better Auth `before`-hook context, re-derived here for the reason
 * `language-preference-guard.ts` gives: no cycle back to the instance factory.
 */
type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * The two engine-owned email preferences on `auth.user`. Both are declared as
 * `user.additionalFields` with `input: true`, which is what lets the profile
 * page's switches write them through `/update-user` — and also what lets ANY
 * signed-in account send them there.
 */
const NOTIFICATION_PREFERENCE_FIELDS = ['notifyAutomationAlerts', 'notifyWeeklyDigest'] as const

/** `true` when the self-service body carries either preference at all. */
const carriesPreference = (body: unknown): boolean => {
  if (typeof body !== 'object' || body === null) return false
  const fields = body as Readonly<Record<string, unknown>>
  return NOTIFICATION_PREFERENCE_FIELDS.some((field) => fields[field] !== undefined)
}

/**
 * The `user.additionalFields` entries for the two preferences. `input: true`
 * lets `/update-user` accept them (who may is this guard's call), and
 * `defaultValue: true` matches the columns' `NOT NULL DEFAULT true`, so the
 * session object carries both for every account, old rows included.
 */
export const NOTIFICATION_PREFERENCE_ADDITIONAL_FIELDS = {
  notifyAutomationAlerts: { type: 'boolean', required: false, input: true, defaultValue: true },
  notifyWeeklyDigest: { type: 'boolean', required: false, input: true, defaultValue: true },
} as const

/**
 * Refuse a notification preference written through `/update-user` by an account
 * that is not admin-tier, with the SAME 400 the language guard answers.
 *
 * ─── WHY ONLY ADMIN-TIER ────────────────────────────────────────────────────
 *
 * The preferences choose whether an OPERATOR receives the instance's operator
 * emails — automation alerts and the weekly summary. Only admin-tier accounts
 * ever receive them, so a member writing either would store a value nothing
 * reads, which the account export would then publish as though it meant
 * something. The door is the one place that can still say no.
 *
 * ─── WHY ONLY `/update-user` ────────────────────────────────────────────────
 *
 * It is the self-service door, where the CALLER is writing their own row. The
 * two admin doors (`/admin/create-user`, `/admin/update-user`) are already
 * gated to admins by the admin plugin, and sign-up creates an account whose
 * defaults are the right answer anyway.
 *
 * ─── STATUS CODE ────────────────────────────────────────────────────────────
 *
 * 400, like the language guard, and for its reason: the caller is writing their
 * OWN row, nothing is enumerable, and the refusal should read the same as the
 * neighbouring one — one vocabulary for "this door does not take that from you".
 */
export async function applyNotificationPreferenceGuard(
  // eslint-disable-next-line functional/prefer-immutable-types -- the Better Auth hook context is mutable by its own type
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable
): Promise<void> {
  if (ctx.path !== '/update-user') return
  if (!carriesPreference(ctx.body)) return

  const session = await getSessionFromCtx(ctx, { disableRefresh: true })
  // No session: `/update-user` answers 401 on its own, so let it.
  if (session === null || session === undefined) return
  const { role } = session.user as { readonly role?: string | null }
  if (typeof role === 'string' && isAdminTier(role, app)) return

  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('BAD_REQUEST', {
    message:
      'Notification preferences belong to the operator emails, which only admin-tier accounts receive.',
  })
}
