/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  credentialAddedNotifierFor,
  type CredentialAddedNotifier,
} from './credential-added-email-handler'
import { endpointSucceeded, type AuthMiddlewareCtx } from './hook-context'
import type { Auth } from '@/domain/models/app/auth'
import type { Languages } from '@/domain/models/app/languages'

/** The adapter calls revocation needs, as every Better Auth context carries them. */
interface ApiKeyRowWriter {
  readonly deleteMany: (input: {
    readonly model: string
    // Mutable, as Better Auth's adapter declares it.
    readonly where: Array<{ field: string; value: string }>
  }) => Promise<unknown>
}

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/**
 * Delete every API key the account owns. A key is a credential that outlives
 * any session, so the acts that shut out whoever else holds the account (a
 * password reset, turning on two-step verification) end its keys too.
 */
const revokeAccountApiKeys = (adapter: ApiKeyRowWriter, userId: string) =>
  adapter.deleteMany({ model: 'apikey', where: [{ field: 'referenceId', value: userId }] })

/**
 * The key revocation a password reset runs, bound to its instance's adapter
 * once `betterAuth` has returned (the reset callback is configured before the
 * instance exists). Unbound, as on an app that takes no API keys, it revokes
 * nothing.
 */
export const lateApiKeyRevoker = () => {
  const slot: { adapter?: Promise<ApiKeyRowWriter> } = {}
  return {
    revoke: async (userId: string): Promise<void> => {
      if (slot.adapter !== undefined) await revokeAccountApiKeys(await slot.adapter, userId)
    },
    bind: (context: Promise<{ readonly adapter: ApiKeyRowWriter }>): void => {
      slot.adapter = context.then((resolved) => resolved.adapter)
    },
  }
}

/** What Better Auth hands `onPasswordReset`: the account whose password was reset. */
type PasswordResetEvent = { readonly user: Readonly<Record<string, unknown>> }

/**
 * Better Auth's `onPasswordReset`, revoking the account's API keys before
 * `next` (the reset automations) runs. Better Auth already ends every session
 * on a reset (`revokeSessionsOnPasswordReset`); a key outlives sessions, so a
 * reset meant to shut someone out ends the keys too. `revoke` is absent when
 * the app takes no API keys.
 */
export const revokingApiKeysOnReset =
  (
    revoke: ((userId: string) => Promise<unknown>) | undefined,
    next: (event: PasswordResetEvent) => Promise<void>
  ) =>
  async (event: PasswordResetEvent): Promise<void> => {
    const userId = stringOf(event.user['id'])
    if (revoke !== undefined && userId !== undefined) await revoke(userId)
    await next(event)
  }

/** The answer an endpoint gave, as an object, whether called over HTTP or not. */
const returnedBody = async (returned: unknown): Promise<Readonly<Record<string, unknown>>> => {
  if (returned instanceof Response) {
    const body: unknown = await returned
      .clone()
      .json()
      .catch(() => undefined)
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  }
  return typeof returned === 'object' && returned !== null
    ? (returned as Record<string, unknown>)
    : {}
}

/** The paths that turn two-step verification on: the email-code method, and a confirmed authenticator. */
const TWO_FACTOR_ON_PATHS: ReadonlySet<string> = new Set([
  '/two-factor/enable',
  '/two-factor/verify-totp',
])

type SessionUser = { readonly id?: unknown; readonly twoFactorEnabled?: unknown }

/**
 * Whether this request is the one that turned two-step verification ON for a
 * signed-in account: it started without it, and left with a new session whose
 * account has it. A second-step SIGN-IN starts with no session, and adding an
 * authenticator to an account already protected starts with it on: neither
 * revokes anything.
 */
const turnedTwoFactorOn = (ctx: AuthMiddlewareCtx): string | undefined => {
  if (!TWO_FACTOR_ON_PATHS.has(ctx.path ?? '')) return undefined
  if (!endpointSucceeded(ctx.context.returned)) return undefined
  const before = ctx.context.session?.user as SessionUser | undefined
  const after = ctx.context.newSession?.user as SessionUser | undefined
  if (before === undefined || before.twoFactorEnabled === true) return undefined
  if (after?.twoFactorEnabled !== true) return undefined
  return stringOf(after.id)
}

/**
 * Once two-step verification is on, end every OTHER session of the account and
 * revoke its API keys: whoever held the account before it was protected keeps
 * nothing. The session that turned it on (the one Better Auth just issued)
 * stays signed in.
 */
const revokeAfterTwoFactorOn = async (ctx: AuthMiddlewareCtx, apiKeys: boolean) => {
  const userId = turnedTwoFactorOn(ctx)
  if (userId === undefined) return
  const kept = ctx.context.newSession?.session.token
  const sessions = await ctx.context.internalAdapter.listSessions(userId)
  const others = sessions.map((session) => session.token).filter((token) => token !== kept)
  if (others.length > 0) await ctx.context.internalAdapter.deleteSessions(others)
  if (apiKeys) await revokeAccountApiKeys(ctx.context.adapter, userId)
}

/** Mail the owner of a key or a passkey that was just added. */
const noticeAddedCredential = async (ctx: AuthMiddlewareCtx, notify: CredentialAddedNotifier) => {
  const kind =
    ctx.path === '/api-key/create'
      ? 'apiKey'
      : ctx.path === '/passkey/verify-registration'
        ? 'passkey'
        : undefined
  if (kind === undefined || !endpointSucceeded(ctx.context.returned)) return
  const added = await returnedBody(ctx.context.returned)
  // A key names its owner (it may be minted for an account server-side, as the
  // device flow does); a passkey is always the signed-in account's own.
  const ownerId =
    kind === 'apiKey'
      ? stringOf(added['referenceId'])
      : (stringOf(added['userId']) ?? stringOf(ctx.context.session?.user.id))
  if (ownerId === undefined) return
  const owner = await ctx.context.internalAdapter.findUserById(ownerId)
  if (owner === null) return
  const { language } = owner as { readonly language?: string | null }
  await notify({ email: owner.email, name: owner.name, language }, kind, stringOf(added['name']))
}

/** How an instance applies the credential rules. */
export interface CredentialLifecycle {
  /** The owner's notice when a key or a passkey is added. */
  readonly notify: CredentialAddedNotifier
  /** Whether the app takes API keys at all (else there is no key to revoke). */
  readonly apiKeys: boolean
}

/** The credential rules of an app: its notice in its own name and languages, unless one is given. */
export const credentialLifecycleOf = (
  authConfig: Auth | undefined,
  appMeta: { readonly name?: string; readonly languages?: Languages } | undefined,
  notify?: CredentialAddedNotifier
): CredentialLifecycle => ({
  notify: notify ?? credentialAddedNotifierFor(appMeta?.name, appMeta?.languages),
  apiKeys: Boolean(authConfig?.apiKeys),
})

/**
 * The after half of the credential rules: a key or a passkey added is mailed
 * to its owner, and turning two-step verification on revokes every other
 * session and every API key of the account.
 */
export async function applyCredentialLifecycleAfterHooks(
  ctx: AuthMiddlewareCtx,
  options: CredentialLifecycle
): Promise<void> {
  await revokeAfterTwoFactorOn(ctx, options.apiKeys)
  await noticeAddedCredential(ctx, options.notify)
}
