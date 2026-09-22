/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The MCP endpoint's OAuth IDENTITY — origin, resource identifier, issuer, and
 * the confidential client the resource server authenticates as.
 *
 * Split out of `mcp-resource-server.ts` in W5b of the layout programme, and the
 * split is the whole point of the file. Everything here is PURE: it reads
 * `process.env` and derives a secret from the instance root secret, and it
 * touches no database. Its former housemate, {@link
 * import('./mcp-resource-server').seedMcpResourceServerClient}, holds the live
 * `db` handle — so a request-path module that only needed to know its own
 * issuer was importing a seeder, and with it the database barrel.
 *
 * That is why `route-setup/mcp/auth.ts` could not move to `presentation/api/`:
 * not because the three functions it wanted were queries — they are not — but
 * because the MODULE they lived in was. Splitting the module is the smallest
 * fix that tells the truth, and it is cheaper than a port for "what is my own
 * origin string", which would have been ceremony around three string
 * concatenations.
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

import { deriveSubkey } from '@/infrastructure/crypto/root-secret'

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
