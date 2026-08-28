/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq } from 'drizzle-orm'
import { deriveSubkey } from '@/infrastructure/crypto/root-secret'
import { db } from '@/infrastructure/database'
import {
  authOauthClientResourcesTable,
  authOauthClientsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'

/**
 * The MCP endpoint's identity as an OAuth 2.1 protected resource, and the
 * confidential client the resource server authenticates as when it introspects
 * a bearer.
 *
 * Both halves exist because `mcp()` issues **JWT** access tokens. A JWT is
 * self-contained: it has no `oauth_access_token` row, and the provider's own
 * `/oauth2/revoke` answers `unsupported_token_type` for one, saying in as many
 * words that it "cannot be revoked server-side". Verifying such a token against
 * the JWKS alone would therefore keep honouring it after the user signed out.
 *
 * Introspection is the control that does see a sign-out: the provider re-reads
 * the token's `sid` claim against the live session row and reports
 * `active: false` once it is gone. Sovrium routes every MCP request through it
 * rather than adding a hand-rolled database predicate of its own.
 */

/** Fixed path the MCP endpoint is mounted at, as a resource identifier suffix. */
const MCP_RESOURCE_PATH = '/mcp'

/**
 * The server's own origin, resolved exactly the way `createAuthInstance`
 * resolves Better Auth's `baseURL` — the two must agree, because the `iss` of
 * every token the provider mints is derived from that same value.
 */
export const resolveAuthOrigin = (): string =>
  (process.env['BASE_URL'] || `http://localhost:${process.env['PORT'] || 3000}`).replace(/\/+$/, '')

/**
 * Canonical RFC 8707 / RFC 9728 protected-resource identifier for this
 * instance's MCP endpoint.
 *
 * `mcp()` needs it at plugin-construction time, so it cannot be derived from a
 * request. It is the value bound into every issued token's `aud`, so the
 * resource server must expect exactly this string and nothing request-derived.
 */
export const mcpResourceIdentifier = (): string => `${resolveAuthOrigin()}${MCP_RESOURCE_PATH}`

/**
 * The issuer every access token carries. Better Auth mounts under its
 * `basePath`, so its resolved `baseURL` — and therefore the `iss` claim — is the
 * origin plus `/api/auth`, not the bare origin.
 */
export const mcpTokenIssuer = (): string => `${resolveAuthOrigin()}/api/auth`

/**
 * Credentials for the resource server's own confidential OAuth client.
 *
 * Derived from the instance root secret rather than read from env: an operator
 * who has to invent and distribute a client secret before MCP works has lost
 * the zero-config property for a credential only the server ever uses. The
 * `purpose` string is the scrypt salt and must stay stable forever — changing
 * it rotates the secret and orphans the seeded row.
 */
export const mcpResourceServerCredentials = (): {
  readonly clientId: string
  readonly clientSecret: string
} => ({
  clientId: 'sovrium-mcp-resource-server',
  clientSecret: deriveSubkey('mcp-resource-server-client-secret').toString('base64url'),
})

/**
 * Hash a client secret to the form the OAuth provider stores.
 *
 * Mirrors the provider's `defaultHasher` (SHA-256, base64url, no padding),
 * which is what `storeClientSecret` applies under the default `"hashed"`
 * strategy. Seeding a plaintext secret would make every introspection fail
 * client authentication.
 */
export const hashOAuthClientSecret = async (secret: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return Buffer.from(digest).toString('base64url')
}

/**
 * Idempotently seed the resource server's confidential client and link it to
 * the MCP protected resource.
 *
 * The link row is not decoration: `isIntrospectionAuthorized` lets a client
 * introspect a token it did not issue **only** when that client is linked to
 * one of the token's audience resources. Without the link every introspection
 * answers `active: false` and MCP rejects every valid bearer.
 *
 * Best-effort by construction — it is called from the startup seeders, and a
 * failure here must not stop a server whose MCP endpoint may never be used.
 */
export const seedMcpResourceServerClient = async (options: {
  readonly hasAuth: boolean
  readonly mcpEnabled: boolean
}): Promise<void> => {
  if (!options.hasAuth || !options.mcpEnabled) return

  const { clientId, clientSecret } = mcpResourceServerCredentials()
  const resource = mcpResourceIdentifier()
  const hashedSecret = await hashOAuthClientSecret(clientSecret)
  const clients = authOauthClientsTable()
  const links = authOauthClientResourcesTable()

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clientId, clientId))
    .limit(1)

  if (existing[0] === undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- seeding a row IS the side effect this function exists for
    await db.insert(clients).values({
      id: clientId,
      clientId,
      clientSecret: hashedSecret,
      name: 'Sovrium MCP resource server',
      redirectUris: [],
      type: 'web',
      disabled: false,
      public: false,
      // The resource server presents its credentials in the request body, which
      // is what upstream's `remoteVerify` sends. Left unset the provider assumes
      // `client_secret_basic` and refuses the pair with `invalid_client`.
      tokenEndpointAuthMethod: 'client_secret_post',
    } as typeof clients.$inferInsert)
  } else {
    // The secret is derived from the root secret, so it changes if the root
    // secret is regenerated. Re-stamping keeps the seeded row usable instead of
    // silently 401-ing every introspection after a key rotation.
    // eslint-disable-next-line functional/no-expression-statements -- re-stamping the row IS the side effect
    await db
      .update(clients)
      .set({ clientSecret: hashedSecret, disabled: false })
      .where(eq(clients.clientId, clientId))
  }

  const linked = await db
    .select({ id: links.id })
    .from(links)
    .where(and(eq(links.clientId, clientId), eq(links.resourceId, resource)))
    .limit(1)

  if (linked[0] === undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- linking the client to the resource IS the side effect
    await db.insert(links).values({
      id: `${clientId}::${resource}`,
      clientId,
      resourceId: resource,
      createdAt: new Date(),
    } as typeof links.$inferInsert)
  }
}
