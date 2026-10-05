/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError, getSessionFromCtx } from 'better-auth/api'
// eslint-disable-next-line boundaries/dependencies -- Better Auth runs the deletion, so its `before` hook and its `beforeDelete` callback are the only points where a last-admin removal can be refused before anything changes. Same justification as the admin role guards.
import { accountRemovalRefusal } from '@/application/use-cases/auth/last-admin-rail'
// eslint-disable-next-line boundaries/dependencies -- see accountRemovalRefusal above: a deletion request that stood can only be observed, and so recorded, from inside Better Auth's `after` hook.
import { recordAccountDeletionRequest } from '@/application/use-cases/auth/record-user-acts'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { purgeAccount, resolvePurgeTableAuthorship } from '@/infrastructure/database/account-purge'
import { runAuthHookProgram } from './admin-role-guards'
import { endpointSucceeded, sessionUserId, type AuthMiddlewareCtx } from './hook-context'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/**
 * Immediate account deletion by mailed link.
 *
 * A signed-in person asks `POST /delete-user`; Better Auth stores a single-use
 * token and mails a link to `/delete-user/callback`; following it while signed
 * in as that account erases the account. Sovrium wires three things into that
 * flow:
 *
 *  - the link is ALWAYS mailed (`sendDeleteAccountVerification` is always set
 *    when the door is open), so Better Auth's no-mail branch — a password or a
 *    fresh session alone — is unreachable;
 *  - the erasure is `purgeAccount`, the scheduled purge's own sweep, run as
 *    Better Auth's `beforeDelete`, so its three deletions that follow find
 *    nothing — one erasure behind both deletion doors;
 *  - the last admin who can sign in is refused with 409 twice: at the request
 *    (where `beforeDelete` does not run), and when the link is followed — by
 *    the erasure itself, which counts the other admins under a lock.
 */

/** The request that mails the link, and the link itself. */
const DELETE_USER_PATH = '/delete-user'
const DELETE_USER_CALLBACK_PATH = '/delete-user/callback'

/** Injectable for unit tests (no `mock.module()`). */
export type AccountDeletionDeps = {
  /** The rail's message when removing `userId` would leave no admin, `undefined` otherwise. */
  readonly refuseRemoval?: (userId: string, app: AdminRoleResolvable) => Promise<string | undefined>
  readonly recordRequest?: (userId: string) => Promise<void>
  readonly purge?: typeof purgeAccount
}

const removalRefusal = (deps?: AccountDeletionDeps) =>
  deps?.refuseRemoval ??
  ((userId: string, app: AdminRoleResolvable) =>
    runAuthHookProgram(accountRemovalRefusal(userId, app)))

/**
 * `true` when the immediate deletion door is open: the app has auth, has not
 * closed the door (`auth.immediateAccountDeletion: false`), and the instance
 * can send the mail the door depends on. Anything else answers 404 exactly as
 * a door that does not exist.
 */
export const isImmediateAccountDeletionOpen = (
  authConfig: Auth | undefined,
  emailConfigured: boolean
): boolean =>
  authConfig !== undefined && authConfig.immediateAccountDeletion !== false && emailConfigured

/** The confirmation mail, as the email handlers take it. */
type AccountDeletionMailer = (
  input: Readonly<{ email: string; name?: string; url: string }>
) => Promise<void>

/**
 * Better Auth's `user.deleteUser` block, or `undefined` when the door is
 * closed — which leaves `/delete-user` and its callback answering 404.
 */
export const buildDeleteUserConfig = (
  input: Readonly<{
    authConfig: Auth | undefined
    emailConfigured: boolean
    sendConfirmation: AccountDeletionMailer
    tables: App['tables']
  }>,
  deps?: AccountDeletionDeps
) => {
  if (!isImmediateAccountDeletionOpen(input.authConfig, input.emailConfigured)) return undefined
  const app: AdminRoleResolvable = { auth: input.authConfig }
  const purge = deps?.purge ?? purgeAccount
  return {
    enabled: true,
    sendDeleteAccountVerification: async (
      data: Readonly<{ user: Readonly<{ email: string; name?: string }>; url: string }>
    ) => input.sendConfirmation({ email: data.user.email, name: data.user.name, url: data.url }),
    // Runs when the link is followed, before Better Auth's own deletes: the
    // scheduled purge's erasure itself, which runs the last-admin rail inside
    // its own transaction (the other admins may have been demoted since the
    // request). A refusal wrote nothing and answers 409 with the rail's words.
    beforeDelete: async (user: Readonly<{ id: string }>) => {
      const outcome = await purge(
        user.id,
        (input.tables ?? []).map((table) => resolvePurgeTableAuthorship(input.tables, table.name)),
        app
      )
      if (outcome._tag === 'Refused') {
        // eslint-disable-next-line functional/no-throw-statements
        throw new APIError('CONFLICT', { message: outcome.message })
      }
    },
  }
}

/** `true` when this request reaches the open deletion door. */
// eslint-disable-next-line functional/prefer-immutable-types
const doorIsOpen = (ctx: AuthMiddlewareCtx): boolean =>
  ctx.context.options.user?.deleteUser?.enabled === true

/**
 * Refuse a `callbackURL` that is not a same-site path. Better Auth checks it
 * against the trusted origins at the callback; this holds the link to the
 * narrower rule every other Sovrium redirect follows, before a link is mailed.
 */
const guardCallbackUrl = (value: unknown): void => {
  if (value === undefined || toSafeRedirectPath(value) !== undefined) return
  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('BAD_REQUEST', { message: 'Invalid callbackURL' })
}

/**
 * The `before` half: a same-site callback URL, and the last-admin rail at the
 * request — a refused request stores no token and mails nothing.
 */
export async function applyAccountDeletionBeforeHooks(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  app: AdminRoleResolvable,
  deps?: AccountDeletionDeps
): Promise<void> {
  if (ctx.path === DELETE_USER_CALLBACK_PATH && doorIsOpen(ctx)) {
    guardCallbackUrl((ctx.query as { callbackURL?: unknown } | undefined)?.callbackURL)
    return
  }
  if (ctx.path !== DELETE_USER_PATH || !doorIsOpen(ctx)) return
  guardCallbackUrl((ctx.body as { callbackURL?: unknown } | undefined)?.callbackURL)
  const session = await getSessionFromCtx(ctx, { disableRefresh: true })
  const userId = sessionUserId(session)
  // No session: the endpoint answers 401 on its own.
  if (userId === undefined) return
  const refusal = await removalRefusal(deps)(userId, app)
  if (refusal === undefined) return
  // eslint-disable-next-line functional/no-throw-statements
  throw new APIError('CONFLICT', { message: refusal })
}

/**
 * The `after` half: a request that stood — the link was mailed — goes on the
 * audit trail. A refused one (wrong password, last admin) records nothing, and
 * a request carrying a token is a confirmation, recorded by the erasure.
 */
export async function applyAccountDeletionAfterHooks(
  // eslint-disable-next-line functional/prefer-immutable-types
  ctx: AuthMiddlewareCtx,
  deps?: AccountDeletionDeps
): Promise<void> {
  if (ctx.path !== DELETE_USER_PATH || !endpointSucceeded(ctx.context.returned)) return
  if ((ctx.body as { token?: unknown } | undefined)?.token !== undefined) return
  const userId = sessionUserId(ctx.context.session)
  if (userId === undefined) return
  const record =
    deps?.recordRequest ?? ((id: string) => runAuthHookProgram(recordAccountDeletionRequest(id)))
  await record(userId)
}
