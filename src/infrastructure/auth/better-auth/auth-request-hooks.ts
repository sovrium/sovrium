/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAuthMiddleware, APIError } from 'better-auth/api'
import {
  applyAccountDeletionAfterHooks,
  applyAccountDeletionBeforeHooks,
} from './account-deletion-hooks'
import { applyAccountPreferenceGuards, writablePreferenceLanguages } from './account-preferences'
import { applyAdminRoleAfterHooks, applyAdminRoleGuards } from './admin-role-guards'
import { applyAdminUserActAfterHooks, applyAdminUserActBeforeHooks } from './admin-user-act-hooks'
import { applyAuthEventAfterHooks, applyAuthEventBeforeHooks } from './auth-event-hooks'
import { applyAvatarUrlGuard } from './avatar-url-guard'
import { applyDisplayNameGuard } from './display-name-guard'
import { applyRealtimeGrantAfterHooks, applyRealtimeGrantBeforeHooks } from './realtime-grant-hooks'
import type { AuthHookDeps } from './admin-role-guards'
import type { AdminUserActDeps } from './admin-user-act-hooks'
import type { AuthHookContext } from './auth-database-hooks'
import type { createEmailHandlers } from './email-handlers'
import type { Auth } from '@/domain/models/app/auth'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { Languages } from '@/domain/models/app/languages/language'

/**
 * Better Auth's request hooks: the password rule on admin-created users, and
 * the backup codes captured when two-factor is enabled.
 */

type AuthMiddlewareCtx = Parameters<typeof createAuthMiddleware>[0] extends (
  ctx: infer C
) => unknown
  ? C
  : never

/**
 * Validate admin create-user password length (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 *
 * Re-verified against Better Auth 1.6.11 (May 2026, refactor item [internal ref]):
 * STILL REQUIRED. The vendored `admin/routes.ts` `createUser` route hashes
 * `ctx.body.password` directly with no `minPasswordLength`/`maxPasswordLength`
 * check (`createUserBodySchema` declares `password: z.string().optional()` with
 * no length constraints), whereas the sibling `set-user-password` route *does*
 * validate length. The upstream bug is unfixed — keep this `before`-hook guard.
 */
async function validateAdminCreateUserPassword(ctx: AuthMiddlewareCtx) {
  const body = ctx.body as { password?: string }
  if (!body?.password) return
  const minLength = 8
  const maxLength = 128
  if (body.password.length < minLength) {
    throw new APIError('BAD_REQUEST', {
      message: `Password must be at least ${minLength} characters`,
    })
  }
  if (body.password.length > maxLength) {
    throw new APIError('BAD_REQUEST', {
      message: `Password must not exceed ${maxLength} characters`,
    })
  }
}

/**
 * Extract backup codes from the two-factor enable response.
 * Handles both direct object and Response (when called via HTTP) formats.
 */
async function extractBackupCodes(
  returned: Readonly<{ backupCodes?: readonly string[] }> | Response
): Promise<Readonly<{ backupCodes?: readonly string[] }> | undefined> {
  if (returned instanceof Response) {
    return returned.status === 200
      ? ((await returned.clone().json()) as { backupCodes?: readonly string[] })
      : undefined
  }
  return returned
}

type AuthSessionUser = { email: string; name?: string } | undefined

type TwoFactorBackupCodesHandler = NonNullable<
  ReturnType<typeof createEmailHandlers>['twoFactorBackupCodes']
>

async function handleTwoFactorEnable(
  ctx: Readonly<Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]>,
  sendBackupCodes: TwoFactorBackupCodesHandler
): Promise<void> {
  const returned = ctx.context.returned as
    { backupCodes?: readonly string[] } | Response | undefined
  if (!returned) return
  const data = await extractBackupCodes(returned)
  if (!data?.backupCodes) return
  const user = ctx.context.session?.user as AuthSessionUser
  if (!user?.email) return
  await sendBackupCodes({
    email: user.email,
    name: user.name,
    codes: data.backupCodes,
  })
}

/**
 * Build auth hooks with request validation middleware
 *
 * Validates password length for admin createUser endpoint (Better Auth Issue #4651 workaround).
 * The admin plugin doesn't respect emailAndPassword validation settings.
 *
 * Also applies the admin role-mutation guards — see {@link applyAdminRoleGuards}:
 * an unassignable role value is a 400, a last-admin demotion is a 409, and an
 * admin-tier impersonation target is a 403. All three run in `before`, because
 * Better Auth owns the write. The `after` half
 * ({@link applyAdminRoleAfterHooks}) counts the admins again once a demotion
 * has committed, undoing one that left none with a 409, and puts every role
 * change and impersonation that stood on the admin audit trail. Bans, lifted
 * bans and admin-set passwords that stood go on the same trail, and a password
 * an admin set ends the target's sessions ({@link applyAdminUserActAfterHooks}).
 * Any request that changed what an account may read — a role, a ban, a group
 * membership, a revoked session, a removed account — closes that account's
 * live realtime connections so they are judged again at the handshake
 * ({@link applyRealtimeGrantAfterHooks}). A self-service deletion request is
 * held to the last-admin rail before its link is mailed, and one that stood is
 * put on the audit trail ({@link applyAccountDeletionBeforeHooks},
 * {@link applyAccountDeletionAfterHooks}). A sign-out that ended a session
 * fires the app's `auth` automations ({@link applyAuthEventBeforeHooks},
 * {@link applyAuthEventAfterHooks}); a sign-in fires them from a plugin, which
 * runs after the two-factor plugin may have taken the session back.
 *
 * `authConfig` supplies the app's role vocabulary; when it is absent the admin
 * plugin is not registered at all (`buildAdminPlugin` returns `[]`), so those
 * paths 404 before any guard could matter.
 *
 * Note: The /change-email endpoint uses Better Auth 1.5's native email enumeration protection,
 * which always returns 200 OK regardless of whether the target email exists.
 */
export function buildAuthHooks(
  handlers?: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig?: Auth,
  deps?: AuthHookDeps & AdminUserActDeps,
  extras: { readonly languages?: Languages; readonly hookContext?: AuthHookContext } = {}
) {
  const { hookContext } = extras
  // The languages a written preference may name: the app's own, plus the
  // mounted console's (see `writablePreferenceLanguages`).
  const languages =
    extras.languages ??
    (hookContext === undefined ? undefined : writablePreferenceLanguages(hookContext.appMeta))
  const roleApp: AdminRoleResolvable = { auth: authConfig }
  return {
    before: createAuthMiddleware(async (ctx) => {
      // Strip markup from `name` on every path that writes it (sign-up, the
      // self-service update and both admin routes).
      applyDisplayNameGuard(ctx)
      if (ctx.path === '/admin/create-user') {
        await validateAdminCreateUserPassword(ctx)
      }
      // Refuse a client-supplied `auth.user.image` on every path that can write
      // it. Better Auth stores that column verbatim and several readers project
      // it into OTHER users' browsers, so this `before` hook is the only point
      // at which the value can be rejected before the row changes.
      applyAvatarUrlGuard(ctx)
      // Refuse a language this app does not declare, and an operator-email
      // switch from an account that is not admin-tier, on every path that can
      // write them. Better Auth stores a DECLARED additional field verbatim, so
      // without this a column would keep a value nothing can honour — and the
      // account export would publish it.
      await applyAccountPreferenceGuards(ctx, languages, roleApp)
      await applyAdminRoleGuards(ctx, roleApp, deps)
      await applyAdminUserActBeforeHooks(ctx, deps)
      await applyRealtimeGrantBeforeHooks(ctx)
      await applyAccountDeletionBeforeHooks(ctx, roleApp)
      await applyAuthEventBeforeHooks(ctx)
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/two-factor/enable' && handlers?.twoFactorBackupCodes) {
        await handleTwoFactorEnable(ctx, handlers.twoFactorBackupCodes)
      }
      await applyAccountDeletionAfterHooks(ctx)
      await applyAdminRoleAfterHooks(ctx, roleApp, deps)
      await applyAdminUserActAfterHooks(ctx, deps)
      // A grant that changed closes the account's live realtime
      // connections, after the role guards have had the chance to undo it.
      await applyRealtimeGrantAfterHooks(ctx)
      // The sign-out automations, once every guard has had its say.
      await applyAuthEventAfterHooks(ctx, hookContext)
    }),
  }
}
