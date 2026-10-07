/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { OAuthTokenClient } from '@/application/ports/services/oauth-token-client'
import { isLongLivedRenewalDue } from '@/domain/models/app/connections/long-lived-token-service'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import { buildRefreshProps } from './client-credentials-token'
import type { ConnectionDef } from './static-auth-header'

class LongLivedRenewalError extends Data.TaggedError('LongLivedRenewalError')<{
  readonly cause: unknown
}> {}

/** The stored token fields a renewal reads. */
interface RenewableToken {
  readonly accessToken: string
  readonly expiresAt: Date | undefined
  readonly tokenFields?: Readonly<Record<string, string>> | undefined
}

/** Which store the token lives in: a user's row, or the connection's shared one. */
type RenewalScope = { readonly kind: 'user'; readonly userId: string } | { readonly kind: 'app' }

export type RenewalOutcome = {
  readonly ok: true
  readonly token: string
  readonly fields?: Readonly<Record<string, string>> | undefined
}

/** `longLivedToken` of an OAuth2 connection, when it declares Meta's exchange. */
const longLivedTokenOf = (
  conn: ConnectionDef
): { readonly renewWithinDays: number | undefined } | undefined => {
  const declared = (
    conn.props as { longLivedToken?: { style?: unknown; renewWithinDays?: unknown } }
  ).longLivedToken
  if (declared?.style !== 'meta') return undefined
  const days = declared.renewWithinDays
  return { renewWithinDays: typeof days === 'number' ? days : undefined }
}

/** Whether a still-valid stored token has entered its renewal window. */
export const isRenewalDue = (conn: ConnectionDef, token: RenewableToken): boolean => {
  const declared = longLivedTokenOf(conn)
  return declared !== undefined && isLongLivedRenewalDue(token.expiresAt, declared.renewWithinDays)
}

const storeRenewedToken = (
  connectionId: string,
  scope: RenewalScope,
  renewed: { readonly accessToken: string; readonly expiresAt: Date | undefined }
): Effect.Effect<void, unknown, ConnectionTokenRepository | OAuthTokenClient> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const { accessToken, expiresAt } = renewed
    const common = { connectionId, accessToken, ...(expiresAt !== undefined ? { expiresAt } : {}) }
    yield* scope.kind === 'user'
      ? Effect.asVoid(tokenRepo.upsertForUser({ ...common, userId: scope.userId }))
      : Effect.asVoid(tokenRepo.upsertForApp(common))
  })

/**
 * Renew a still-valid long-lived token (`longLivedToken: { style: meta }`)
 * that has entered its renewal window: exchange it for a fresh one, store it,
 * and call with the fresh one. Renewal is use-driven, as Meta expects. The
 * stored token is still valid, so a refused or failed exchange is logged and
 * the call goes ahead with it — the next call inside the window tries again.
 * Concurrent calls for the same token share one exchange.
 */
export const renewLongLivedToken = (
  conn: ConnectionDef,
  token: RenewableToken,
  connectionId: string,
  scope: RenewalScope
): Effect.Effect<RenewalOutcome, never, ConnectionTokenRepository | OAuthTokenClient> => {
  const current: RenewalOutcome = { ok: true, token: token.accessToken, fields: token.tokenFields }
  const renew = Effect.gen(function* () {
    const props = buildRefreshProps(conn)
    if (props === undefined) return current
    const result = yield* OAuthTokenClient.use((tokens) =>
      tokens.exchangeLongLivedToken(props, token.accessToken)
    ).pipe(Effect.mapError((error) => new LongLivedRenewalError({ cause: error.cause })))
    if (!result.ok) {
      logWarning('[connections] long-lived token renewal refused; using the stored token', {
        'sovrium.connection.name': conn.name,
        'sovrium.connection.renewal_error': result.error,
      })
      return current
    }
    yield* storeRenewedToken(connectionId, scope, result).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[connections] renewed long-lived token not stored', cause))
      ),
      // effect-swallow: the fresh token is still used for this call and the stored one stays valid; the next call inside the window renews again. The cause is logged just above.
      Effect.ignore
    )
    return { ok: true, token: result.accessToken, fields: token.tokenFields } as const
  })
  return OAuthTokenClient.use((tokens) =>
    tokens.withRefreshLock(
      { connectionId, userId: scope.kind === 'user' ? scope.userId : undefined },
      renew.pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[connections] long-lived token renewal failed', cause))
        ),
        // effect-swallow: the stored token is still valid, so a failed renewal falls back to it; the cause is logged just above.
        Effect.orElseSucceed(() => current)
      ),
      (cause) => new LongLivedRenewalError({ cause })
    )
  ).pipe(
    Effect.catchTag('LongLivedRenewalError', () => Effect.succeed(current)),
    Effect.withSpan('automations.renew-long-lived-token')
  )
}
