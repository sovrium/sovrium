/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { Data, Effect } from 'effect'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { withProviderEndpoints } from '@/domain/models/app/connections/oauth2-provider-validation'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import {
  requestClientCredentialsToken,
  withRefreshLockEffect,
  type OAuth2RefreshProps,
} from '@/infrastructure/connections/token-refresh'
import { stringProp } from './shared'
import type { ConnectionDef } from './static-auth-header'

/**
 * The client credentials grant (RFC 6749 §4.4) for an OAuth2 connection
 * declaring `grantType: clientCredentials`.
 *
 * Machine-to-machine: nobody authorizes anything. The first call that needs a
 * token asks the token endpoint for one with the connection's own client id
 * and secret, stores it as the connection's shared (`app`) credential — the
 * same encrypted store an admin-authorized connection uses — and every later
 * call reuses it until it expires, when the next call asks again. A provider
 * rate-limits its token endpoint too, so asking once per call is not an option.
 *
 * Concurrent first calls coalesce through the same single-flight lock as a
 * refresh, keyed on the connection's shared scope.
 */

class ClientCredentialsTransportError extends Data.TaggedError('ClientCredentialsTransportError')<{
  readonly cause: unknown
}> {}

export type ClientCredentialsOutcome =
  | {
      readonly ok: true
      readonly token: string
      readonly fields?: Readonly<Record<string, string>> | undefined
    }
  | { readonly ok: false; readonly reason: string }

/**
 * Build the `OAuth2RefreshProps` shape consumed by
 * `refreshAccessToken`. Mirrors the OAuth2Props read by
 * `connections/index.ts` but trimmed to the fields the refresh request
 * actually forwards. Returns `undefined` when any of the three required
 * client-config fields is missing — the caller surfaces this as a
 * "missing client config for refresh" failure rather than POSTing with
 * empty credentials.
 *
 * Note: `stringProp` returns `''` (not `undefined`) when a key is
 * missing on `conn.props`, so the required-field guard compares against
 * the empty string. The previous `=== undefined` check was dead code
 * and would have let a misconfigured connection POST to an empty URL.
 */
export const buildRefreshProps = (conn: ConnectionDef): OAuth2RefreshProps | undefined => {
  const clientId = stringProp(conn.props, 'clientId')
  const clientSecret = stringProp(conn.props, 'clientSecret')
  const tokenUrl = stringProp(withProviderEndpoints(conn.props), 'tokenUrl')
  if (clientId === '' || clientSecret === '' || tokenUrl === '') {
    return undefined
  }
  const { scopes } = conn.props as { scopes?: readonly string[] }
  const audience = stringProp(conn.props, 'audience')
  const { extraTokenParams } = conn.props as {
    extraTokenParams?: Record<string, string>
  }
  const authMethod = stringProp(conn.props, 'authenticationMethod')
  const { tokenFields } = conn.props as { tokenFields?: readonly string[] }
  return {
    ...(tokenFields !== undefined ? { keepFields: tokenFields } : {}),
    clientId,
    clientSecret,
    tokenUrl,
    ...(scopes !== undefined ? { scopes } : {}),
    ...(audience !== '' ? { audience } : {}),
    ...(extraTokenParams !== undefined ? { extraTokenParams } : {}),
    ...(authMethod === 'header' || authMethod === 'body'
      ? { authenticationMethod: authMethod }
      : {}),
  }
}

/**
 * A hash of everything that shapes the token request: the client, its secret,
 * the endpoint, the scopes, the audience, the extra params and where the
 * credentials go. A stored token obtained under another configuration — a
 * rotated secret, an added scope — is not reused: it was issued for something
 * the connection no longer asks for. Only the hash is stored, never the secret.
 */
const grantFingerprint = (props: OAuth2RefreshProps): string =>
  createHash('sha256')
    .update(
      JSON.stringify([
        props.clientId,
        props.clientSecret,
        props.tokenUrl,
        props.scopes ?? [],
        props.audience ?? '',
        props.extraTokenParams ?? {},
        props.authenticationMethod ?? 'header',
      ])
    )
    .digest('hex')

const requestAndStore = (
  name: string,
  props: OAuth2RefreshProps,
  connectionId: string
): Effect.Effect<ClientCredentialsOutcome, never, ConnectionTokenRepository> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => requestClientCredentialsToken(props),
      catch: (cause) => new ClientCredentialsTransportError({ cause }),
    }).pipe(
      Effect.catchTag('ClientCredentialsTransportError', () =>
        Effect.succeed({ ok: false as const, error: 'token_request_failed' })
      )
    )
    if (!result.ok) {
      return {
        ok: false,
        reason: `connection ${name}: client credentials token request refused (${result.error})`,
      } as const
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const stored = yield* tokenRepo
      .upsertForApp({
        connectionId,
        accessToken: result.accessToken,
        ...(result.expiresAt !== undefined ? { expiresAt: result.expiresAt } : {}),
        ...(result.fields !== undefined ? { tokenFields: result.fields } : {}),
        grantFingerprint: grantFingerprint(props),
      })
      .pipe(
        Effect.map(() => true),
        // effect-swallow: the failure is RETURNED as `false` and turned into the step's refusal below; a token that cannot be stored must not be used, or the next call would ask the provider again.
        Effect.orElseSucceed(() => false)
      )
    if (!stored) {
      return {
        ok: false,
        reason: `connection ${name}: client credentials token obtained but could not be stored`,
      } as const
    }
    return { ok: true, token: result.accessToken, fields: result.fields } as const
  })

/** A stored token this close to its expiry is treated as expired. */
const EXPIRY_SKEW_MS = 5000

/**
 * The shared token of a `grantType: clientCredentials` connection: the stored
 * one while it is valid, otherwise a new one from the token endpoint. There is
 * no refresh token and nobody to ask for consent — the grant itself is renewed.
 * An unreadable stored token (a changed encryption key) is simply replaced.
 */
export const resolveClientCredentialsToken = (
  name: string,
  props: OAuth2RefreshProps | undefined,
  connectionId: string
): Effect.Effect<ClientCredentialsOutcome, never, ConnectionTokenRepository> =>
  Effect.gen(function* () {
    const tokenRepo = yield* ConnectionTokenRepository
    const stored = yield* tokenRepo.findForApp({ connectionId }).pipe(
      // effect-swallow: an unreadable row is not an outage here — the grant can mint a replacement without anyone's help, which the branch below does.
      Effect.orElseSucceed(() => undefined)
    )
    const valid =
      stored !== undefined &&
      props !== undefined &&
      stored.grantFingerprint === grantFingerprint(props) &&
      !isSentinelAccessToken(stored.accessToken) &&
      (stored.expiresAt === undefined || stored.expiresAt.getTime() - Date.now() >= EXPIRY_SKEW_MS)
    if (valid) return { ok: true, token: stored.accessToken, fields: stored.tokenFields } as const
    return yield* obtainClientCredentialsToken(name, props, connectionId)
  }).pipe(Effect.withSpan('automations.resolve-client-credentials-token'))

/**
 * Obtain a fresh client-credentials token for `connectionId` and store it,
 * once even when several calls arrive together.
 */
export const obtainClientCredentialsToken = (
  name: string,
  props: OAuth2RefreshProps | undefined,
  connectionId: string
): Effect.Effect<ClientCredentialsOutcome, never, ConnectionTokenRepository> => {
  if (props === undefined) {
    return Effect.succeed({
      ok: false,
      reason: `connection ${name}: missing clientId, clientSecret or tokenUrl for the client credentials grant`,
    } as const)
  }
  return withRefreshLockEffect(
    { connectionId, userId: undefined },
    requestAndStore(name, props, connectionId),
    (cause) => new ClientCredentialsTransportError({ cause })
  ).pipe(
    Effect.catchTag('ClientCredentialsTransportError', () =>
      Effect.succeed({
        ok: false,
        reason: `connection ${name}: client credentials token request failed`,
      } as const)
    ),
    Effect.withSpan('automations.obtain-client-credentials-token')
  )
}
