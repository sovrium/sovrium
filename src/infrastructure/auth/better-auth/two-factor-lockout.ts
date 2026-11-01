/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import { Option, Schema } from 'effect'
import {
  twoFactorUnlockRequestSchema,
  twoFactorUnlockResponseSchema,
} from '@/domain/models/api/auth/auth'
import { isAdminEquivalent, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import { logError } from '@/infrastructure/logging/logger'
import { notFoundError } from './auth-not-found'
import { TWO_FACTOR_COOKIE } from './two-factor-attempt-keys'
import type { AuthMiddlewareCtx } from './hook-context'
import type { TwoFactorLockoutNotifier } from './two-factor-lockout-email-handler'
import type { BetterAuthPlugin } from 'better-auth'

/**
 * The account-level lockout of the second sign-in step, made Sovrium's own:
 * the numbers Better Auth's two-factor plugin enforces (passed to it as
 * `accountLockout`), the email the account's address receives when the lock
 * starts, and the route an administrator clears it with.
 */

/** Wrong codes in a row, across sign-ins and factors, before the second step locks. */
export const TWO_FACTOR_LOCKOUT_ATTEMPTS = 10

/** How long the second step stays locked, in seconds. */
export const TWO_FACTOR_LOCKOUT_SECONDS = 15 * 60

/** The `accountLockout` option of Better Auth's two-factor plugin. */
export const TWO_FACTOR_ACCOUNT_LOCKOUT = {
  enabled: true,
  maxFailedAttempts: TWO_FACTOR_LOCKOUT_ATTEMPTS,
  durationSeconds: TWO_FACTOR_LOCKOUT_SECONDS,
} as const

/** The routes that check a second-step code, as Better Auth names them. */
const VERIFY_PATHS: ReadonlySet<string> = new Set([
  '/two-factor/verify-totp',
  '/two-factor/verify-otp',
  '/two-factor/verify-backup-code',
])

/** A `two_factor` row's lockout columns, as the adapter reads them back. */
interface TwoFactorLockRow extends Record<string, unknown> {
  readonly id: string
  readonly lockedUntil?: Date | string | null
}

/** The `verification` identifier recording that the lock of row `rowId` was announced. */
export const lockNoticeIdentifier = (rowId: string): string => `2fa-lock-notice-${rowId}`

/** The instant `lockedUntil` names, when it names one still ahead of `now`. */
export const activeLockEnd = (
  lockedUntil: Date | string | null | undefined,
  now: number
): Date | undefined => {
  if (lockedUntil === null || lockedUntil === undefined) return undefined
  const end = new Date(lockedUntil)
  return Number.isNaN(end.getTime()) || end.getTime() <= now ? undefined : end
}

const findTwoFactorRow = (ctx: AuthMiddlewareCtx, userId: string) =>
  ctx.context.adapter.findOne<TwoFactorLockRow>({
    model: 'twoFactor',
    where: [{ field: 'userId', value: userId }],
  })

/**
 * The account a sign-in's second step belongs to, read from the signed
 * `two_factor` cookie exactly as the plugin reads it. Only a sign-in counts
 * toward the lock, and a sign-in is always carried by that cookie.
 */
const signInUserId = async (ctx: AuthMiddlewareCtx): Promise<string | undefined> => {
  const cookieName = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name
  const attemptId = await ctx.getSignedCookie(cookieName, ctx.context.secret)
  if (!attemptId) return undefined
  const attempt = await ctx.context.internalAdapter.findVerificationValue(attemptId)
  return attempt?.value
}

/**
 * Whether the lock ending at `end` is announced for the first time here. The
 * record is written before the email goes, keyed by the row and valued by the
 * lock's end, and lives as long as the lock: the wrong code that started the
 * lock announces it, and no later request repeats it.
 */
const claimNotice = async (ctx: AuthMiddlewareCtx, rowId: string, end: Date): Promise<boolean> => {
  const identifier = lockNoticeIdentifier(rowId)
  const announced = await ctx.context.internalAdapter.findVerificationValue(identifier)
  if (announced?.value === end.toISOString()) return false
  await ctx.context.internalAdapter.createVerificationValue({
    identifier,
    value: end.toISOString(),
    expiresAt: end,
  })
  return true
}

/**
 * After a refused code: when the refusal is the one that locked the account,
 * tell its address. A failure here is logged and swallowed — the lock is
 * already in force, and the answer to the code is the plugin's either way.
 */
const announceLock = async (ctx: AuthMiddlewareCtx, notify: TwoFactorLockoutNotifier) => {
  const { returned } = ctx.context
  if (!(returned instanceof APIError) || returned.statusCode !== 401) return
  try {
    const userId = await signInUserId(ctx)
    if (userId === undefined) return
    const row = await findTwoFactorRow(ctx, userId)
    const end = activeLockEnd(row?.lockedUntil, Date.now())
    if (row === null || end === undefined) return
    if (!(await claimNotice(ctx, row.id, end))) return
    const user = await ctx.context.internalAdapter.findUserById(userId)
    if (user === null) return
    const { language } = user as { readonly language?: string | null }
    await notify(
      { email: user.email, name: user.name, language },
      Math.round(TWO_FACTOR_LOCKOUT_SECONDS / 60)
    )
  } catch (error) {
    logError('[auth:two-factor] could not announce a two-step sign-in lock', error)
  }
}

const decodeUnlock = Schema.decodeUnknownOption(twoFactorUnlockRequestSchema)
const encodeUnlocked = Schema.encodeSync(twoFactorUnlockResponseSchema)

/**
 * Whether the caller is an administrator of the app, judged from the account
 * role as stored now, never a cookie-cached copy.
 */
const callerIsAdministrator = async (
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable
): Promise<boolean> => {
  const session = await getSessionFromCtx(ctx, { disableRefresh: true })
  if (!session) return false
  const caller = await ctx.context.internalAdapter.findUserById(session.user.id)
  const role = (caller as { readonly role?: unknown } | null)?.role
  return typeof role === 'string' && isAdminEquivalent(role, app)
}

/**
 * `POST /two-factor/unlock` — an administrator clears an account's two-step
 * lock: the count of wrong codes starts again from zero and the right code is
 * accepted at once. Two-step verification stays on. Anyone who is not an
 * administrator, and an account with no second step, is answered 404.
 */
const unlockEndpoint = (app: AdminRoleResolvable) =>
  createAuthEndpoint(
    '/two-factor/unlock',
    { method: 'POST', requireHeaders: true },
    async (ctx) => {
      if (!(await callerIsAdministrator(ctx, app))) throw notFoundError()
      const request = decodeUnlock(ctx.body)
      if (Option.isNone(request)) {
        throw new APIError('BAD_REQUEST', {
          message: 'userId, the id of the account to unlock, is required',
        })
      }
      const row = await findTwoFactorRow(ctx, request.value.userId)
      if (row === null) throw notFoundError()
      await ctx.context.adapter.update({
        model: 'twoFactor',
        where: [{ field: 'id', value: row.id }],
        update: { failedVerificationCount: 0, lockedUntil: null },
      })
      return ctx.json(encodeUnlocked({ success: true }))
    }
  )

/**
 * The plugin carrying the lockout notice and the unlock route. Registered
 * right after Better Auth's two-factor plugin, so its `after` hook sees the
 * lock that plugin has just written.
 */
export const buildTwoFactorLockoutPlugin = (
  app: AdminRoleResolvable,
  notify: TwoFactorLockoutNotifier
) =>
  ({
    id: 'sovrium-two-factor-lockout',
    endpoints: { unlockTwoFactor: unlockEndpoint(app) },
    hooks: {
      after: [
        {
          matcher: (ctx: { readonly path?: string }) => VERIFY_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware((ctx) => announceLock(ctx, notify)),
        },
      ],
    },
  }) satisfies BetterAuthPlugin
