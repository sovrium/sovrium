/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Option } from 'effect'
import {
  OAuthClientError,
  OAuthClientRegistrar,
} from '@/application/ports/services/oauth-client-registrar'
import { SIGN_IN_CLIENT_SCOPES } from '@/domain/models/app/automations/actions/auth/oauth-client-validation'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Live `OAuthClientRegistrar` over the app's own OAuth provider plugin.
 *
 * The provider's own client endpoints — the admin one included — act for a
 * signed-in owner, and a step has no session. So the client row is written
 * through the provider's adapter, in the provider's own encoding:
 *
 * - **Register** writes the one fixed shape these clients take, and NO link to
 *   the MCP server's protected resource — the link every registration through
 *   the provider gets by default (`clientRegistrationDefaultResources`). A
 *   sign-in client is never a client of the MCP server, so no token it obtains
 *   is accepted at `/mcp`.
 * - **Rotate** and **delete** reach only a client carrying the
 *   {@link REGISTERED_BY} mark — never one an MCP client registered for itself.
 *
 * The engine module is loaded lazily, as `ConfigAccountProvisionerLive` does.
 */

/** The metadata mark a client registered by these steps carries. */
const REGISTERED_BY = 'sovrium-automation'

/** The client-secret encoding the provider uses beside the JWT plugin: SHA-256, base64url, unpadded. */
const hashClientSecret = async (secret: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return Buffer.from(digest).toString('base64url')
}

/** A random identifier or secret: `bytes` random bytes, base64url. */
const randomToken = (bytes: number): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url')

/** The adapter calls the steps make, on the provider's own models. */
interface ClientAdapter {
  readonly create: (query: {
    readonly model: string
    readonly data: Readonly<Record<string, unknown>>
  }) => Promise<unknown>
  readonly findOne: (query: {
    readonly model: string
    readonly where: readonly { readonly field: string; readonly value: string }[]
  }) => Promise<Readonly<Record<string, unknown>> | null>
  readonly update: (query: {
    readonly model: string
    readonly where: readonly { readonly field: string; readonly value: string }[]
    readonly update: Readonly<Record<string, unknown>>
  }) => Promise<unknown>
  readonly delete: (query: {
    readonly model: string
    readonly where: readonly { readonly field: string; readonly value: string }[]
  }) => Promise<unknown>
}

/** The engine built from the app's auth config, and its adapter. */
const engineFor = async (authConfig: Auth | undefined) => {
  const { createAuthInstance } = await import('./auth')
  const { adapter } = await createAuthInstance(authConfig).$context
  // eslint-disable-next-line sovrium/no-double-assertion -- the adapter is typed against the engine's whole model map; these steps touch the provider's client model only, through the four calls `ClientAdapter` names.
  return { adapter: adapter as unknown as ClientAdapter }
}

/** The metadata a stored client row carries, whether the adapter parsed it or not. */
const metadataOf = (row: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const raw = row['metadata']
  if (typeof raw === 'object' && raw !== null) return raw as Readonly<Record<string, unknown>>
  if (typeof raw !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Readonly<Record<string, unknown>>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Whether a stored client is one these steps registered: it carries the
 * {@link REGISTERED_BY} mark, skips consent — which a dynamic registration is
 * refused — and belongs to no user. The mark alone is metadata; the other two
 * are fields no registration through the provider's API can give a client
 * without an admin, so a client an MCP client or a user registered is never
 * reached, whatever its metadata says.
 */
const isRegisteredHere = (row: Readonly<Record<string, unknown>>): boolean =>
  metadataOf(row)['registeredBy'] === REGISTERED_BY &&
  row['skipConsent'] === true &&
  (row['userId'] ?? null) === null &&
  (row['referenceId'] ?? null) === null

/** The client row `clientId` names, when these steps registered it. */
const findRegistered = async (adapter: ClientAdapter, clientId: string) => {
  const row = await adapter.findOne({
    model: 'oauthClient',
    where: [{ field: 'clientId', value: clientId }],
  })
  return row !== null && isRegisteredHere(row) ? row : undefined
}

const register = async (
  authConfig: Auth | undefined,
  client: { readonly name: string; readonly redirectUri: string }
) => {
  const { adapter } = await engineFor(authConfig)
  const clientId = randomToken(24)
  const clientSecret = randomToken(32)
  const now = new Date()
  // Written as the provider writes a registration (`oauthToSchema`), with no
  // resource link: the MCP plugin's default link is never made for this client.
  await adapter.create({
    model: 'oauthClient',
    data: {
      clientId,
      clientSecret: await hashClientSecret(clientSecret),
      disabled: false,
      name: client.name,
      redirectUris: [client.redirectUri],
      tokenEndpointAuthMethod: 'client_secret_post',
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: [...SIGN_IN_CLIENT_SCOPES],
      applicationType: 'web',
      skipConsent: true,
      requirePKCE: true,
      metadata: JSON.stringify({ registeredBy: REGISTERED_BY }),
      createdAt: now,
      updatedAt: now,
    },
  })
  return { clientId, clientSecret }
}

const rotateSecret = async (authConfig: Auth | undefined, clientId: string) => {
  const { adapter } = await engineFor(authConfig)
  if ((await findRegistered(adapter, clientId)) === undefined) return Option.none()
  const clientSecret = randomToken(32)
  await adapter.update({
    model: 'oauthClient',
    where: [{ field: 'clientId', value: clientId }],
    update: { clientSecret: await hashClientSecret(clientSecret), updatedAt: new Date() },
  })
  return Option.some({ clientId, clientSecret })
}

const remove = async (authConfig: Auth | undefined, clientId: string) => {
  const { adapter } = await engineFor(authConfig)
  if ((await findRegistered(adapter, clientId)) === undefined) return false
  await adapter.delete({ model: 'oauthClient', where: [{ field: 'clientId', value: clientId }] })
  return true
}

export const OAuthClientRegistrarLive = Layer.succeed(
  OAuthClientRegistrar,
  OAuthClientRegistrar.of({
    register: (authConfig, client) =>
      Effect.tryPromise({
        try: () => register(authConfig, client),
        catch: (cause) => new OAuthClientError({ cause }),
      }).pipe(Effect.withSpan('auth.register-oauth-client')),
    rotateSecret: (authConfig, clientId) =>
      Effect.tryPromise({
        try: () => rotateSecret(authConfig, clientId),
        catch: (cause) => new OAuthClientError({ cause }),
      }).pipe(Effect.withSpan('auth.rotate-oauth-client-secret')),
    remove: (authConfig, clientId) =>
      Effect.tryPromise({
        try: () => remove(authConfig, clientId),
        catch: (cause) => new OAuthClientError({ cause }),
      }).pipe(Effect.withSpan('auth.delete-oauth-client')),
  })
)
