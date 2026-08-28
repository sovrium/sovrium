/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createMcpProtectedRequestHandler } from '@better-auth/mcp'
import { eq } from 'drizzle-orm'
import { type Context } from 'hono'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import {
  mcpResourceIdentifier,
  mcpResourceServerCredentials,
  mcpTokenIssuer,
} from '@/infrastructure/auth/better-auth/mcp-resource-server'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { JWTPayload } from 'jose'

/**
 * MCP authentication helpers.
 *
 * Split from `mcp-routes.ts` to keep both modules under the project-wide
 * 400-line max-lines limit. Two responsibilities live here:
 *
 *  1. **Credential dispatch**: decide which verifier a request goes to from
 *     the header it presents — `x-api-key` to Better Auth's API-key plugin,
 *     `Authorization: Bearer` to the OAuth provider's own resource-server
 *     handler.
 *  2. **The role bridge**: turn verified access-token claims into the
 *     `{ role, userId }` Sovrium needs. Upstream hands back claims, not a user
 *     record, and Sovrium's RBAC is keyed on `auth.user.role`.
 *
 * The RFC 9728 `WWW-Authenticate` challenge is no longer built here — upstream
 * emits it from `createMcpProtectedRequestHandler`, together with the JSON-RPC
 * error envelope, so an unauthenticated caller gets a conformant challenge
 * without Sovrium hand-assembling one.
 */

/** JSON-RPC 2.0 §5 null id, for a response whose request id is unknown. */
// eslint-disable-next-line unicorn/no-null -- the JSON-RPC wire format specifies null here, not undefined; an omitted id is a different message
const JSONRPC_NULL_ID = null

/**
 * Caller role derived from the bearer token. Drives `tools/list` filtering
 * downstream — viewers see no `_create / _update / _delete` tools, members
 * see a permitted subset, admins see the full surface.
 */
export type McpCallerRole = 'admin' | 'member' | 'viewer'

/**
 * Resolved caller identity.
 *
 * Both surviving credentials name a real Better Auth user, so `userId` is
 * populated on every authenticated path. That is the property the static
 * `MCP_TOKEN_*` gate could not offer: with no subject,
 * `resolveUserContextOrUndefined` returned `undefined` and the Z-3 row-level
 * `user_access` predicate was never evaluated at all. It is still typed
 * optional because `readCallerFromAuthInfo`'s fail-closed fallback constructs
 * a caller without one.
 */
export interface McpCaller {
  readonly role: McpCallerRole
  readonly userId: string | undefined
}

/**
 * The Better Auth instance the request is authenticated against. `/mcp` reuses
 * the one `createHonoApp` already built rather than minting a second: a
 * separate instance would carry a separate plugin array, and the ban check that
 * suspends a key rides on a wrapper around one of those plugins' hooks.
 */
export type McpAuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/**
 * Outcome of the `/mcp` authentication gate.
 *
 * The failure branch carries a ready Response rather than `undefined` because
 * on the OAuth path the rejection is authored upstream: it is an RFC 9728
 * `WWW-Authenticate` challenge wrapped in a JSON-RPC error envelope, and
 * rebuilding it here is how the challenge and the spec drift apart.
 */
export type McpAuthOutcome =
  | { readonly ok: true; readonly caller: McpCaller }
  | { readonly ok: false; readonly response: Response }

/**
 * Authenticate an inbound `/mcp` request and resolve the calling identity.
 *
 * **Dispatch is on the header presented, not on a configured strategy.** An
 * `x-api-key` goes to Better Auth's API-key plugin; anything else goes to the
 * OAuth resource-server handler, which also authors the challenge for a
 * request carrying no credential at all. Header dispatch is total and decidable
 * per request, so no fallback chain exists in which one verifier's failure can
 * mask the other, and both credentials stay live simultaneously — a
 * Claude-Desktop user on OAuth and a CI job holding a key are the same
 * instance's callers.
 *
 * The key must ride on `x-api-key` and not on `Authorization: Bearer`. That is
 * the same rule `/api/*` enforces, and keeping it product-wide is what stops a
 * leaked `Authorization` header from meaning one thing on one path and
 * something else on another.
 *
 * On the OAuth path the request is handed to the provider's own resource-server
 * handler, which verifies the token and — because `remoteVerify.force` is set —
 * routes every request through the provider's introspection endpoint. That
 * single call is what gives Sovrium existence, expiry, per-token revocation
 * where it applies, and session liveness, all evaluated by the provider rather
 * than re-derived here.
 *
 * Session liveness is the load-bearing one. `mcp()` mints audience-bound
 * access tokens as JWTs, and a JWT keeps verifying against the JWKS until it
 * expires no matter what happened to the user meanwhile. Introspection re-reads
 * the token's `sid` against the live session row, so signing out deactivates
 * the token at once — the control that per-token revocation cannot provide for
 * a self-contained token.
 */
export const authenticateMcpRequest = async (
  c: Readonly<Context>,
  authInstance: McpAuthInstance | undefined
): Promise<McpAuthOutcome> => {
  const presentedKey = c.req.header('x-api-key')
  if (presentedKey !== undefined && presentedKey.length > 0) {
    return authenticateWithApiKey(c, authInstance)
  }

  // eslint-disable-next-line functional/no-let -- the verified claims are handed to an inner callback by the upstream handler; there is no return channel for them
  let verifiedClaims: Readonly<JWTPayload> | undefined
  const guard = createMcpProtectedRequestHandler(
    buildResourceServerOptions(c),
    // The upstream handler owns the failure responses; this callback runs only
    // once the token has verified. It returns a sentinel rather than the real
    // MCP response so the dispatcher stays entirely outside the auth gate.
    (_request, accessTokenClaims) => {
      // eslint-disable-next-line functional/no-expression-statements -- capturing the callback's argument is the only way out of it
      verifiedClaims = accessTokenClaims
      return new Response(undefined, { status: 204 })
    }
  )

  const guardResponse = await guard(c.req.raw)
  if (guardResponse.status !== 204 || verifiedClaims === undefined) {
    return { ok: false, response: guardResponse }
  }

  const caller = await bridgeClaimsToCaller(verifiedClaims)
  if (caller === undefined) return { ok: false, response: buildUnauthenticatedResponse() }
  return { ok: true, caller }
}

/**
 * Resolve an `x-api-key` caller through `auth.api.getSession`, forwarding the
 * request headers VERBATIM.
 *
 * **`getSession` is the call, and `verifyApiKey` would be the bug.** The ban
 * check that suspends a banned owner's key is a decoration Sovrium applies to
 * the API-key plugin's `before` hook, whose matcher fires on any endpoint call
 * carrying `x-api-key` — and `getSession` is the call every other Sovrium route
 * makes, so `/mcp` inherits the check by taking the same path. Verifying the
 * key directly would mean re-deriving that check at a second site, which is
 * precisely the duplication that produced the original ban-bypass defect. The
 * headers go through untouched for the same reason: the plugin reads the key
 * off the header itself, and a reconstructed Headers is a second place for the
 * two to disagree.
 *
 * The role is the OWNER's, read live off `auth.user.role` through the same
 * `mapUserRoleToMcpRole` the OAuth path uses. So a demotion narrows every key
 * that user holds without re-issuing any of them, and a ban suspends them.
 *
 * Every failure is a 401 — no key row, a revoked key, a banned owner (which
 * arrives as a thrown `APIError`), or a lookup that blew up. The credential
 * failed to AUTHENTICATE, so the request is indistinguishable from a
 * credential-less one, and a database blip does not leak infrastructure detail
 * to MCP clients.
 */
const authenticateWithApiKey = async (
  c: Readonly<Context>,
  authInstance: McpAuthInstance | undefined
): Promise<McpAuthOutcome> => {
  // Unreachable once mounted: boot refuses `MCP_ENABLED=true` without
  // `app.auth`, and the instance exists whenever `app.auth` does. Failing
  // closed here rather than asserting keeps a future caller honest.
  if (authInstance === undefined) return { ok: false, response: buildUnauthenticatedResponse() }

  try {
    const session = await authInstance.api.getSession({ headers: c.req.raw.headers })
    if (!session) return { ok: false, response: buildUnauthenticatedResponse() }
    const user = session.user as { readonly id: string; readonly role?: string }
    return { ok: true, caller: { role: mapUserRoleToMcpRole(user.role), userId: user.id } }
  } catch {
    return { ok: false, response: buildUnauthenticatedResponse() }
  }
}

/**
 * Verification options for the OAuth provider's resource-server handler.
 *
 * `issuer` and `audience` are the values the provider minted into the token at
 * boot and must NOT be request-derived — a token signed for
 * `http://localhost:0/api/auth` does not verify against an issuer read off the
 * request. The two URLs are the opposite: they are fetched over HTTP by this
 * process, and the boot-time base URL is not reachable when the server was
 * started on port 0 and assigned a real port afterwards, so they are derived
 * from the request the client actually reached us on.
 *
 * `jwksUrl` is currently inert: upstream skips local JWKS verification whenever
 * `remoteVerify.force` is set. It is supplied anyway so that turning `force`
 * off is a one-line change rather than a debugging session.
 */
const buildResourceServerOptions = (c: Readonly<Context>) => {
  const origin = resolveRequestOrigin(c)
  const { clientId, clientSecret } = mcpResourceServerCredentials()
  return {
    issuer: mcpTokenIssuer(),
    audience: mcpResourceIdentifier(),
    jwksUrl: `${origin}/api/auth/jwks`,
    remoteVerify: {
      introspectUrl: `${origin}/api/auth/oauth2/introspect`,
      clientId,
      clientSecret,
      force: true,
    },
  } as const
}

/**
 * Turn verified access-token claims into the `{ role, userId }` the MCP layer
 * runs on. `role` drives `tools/list` filtering; `userId` drives row-level
 * `user_access` enforcement at `tools/call` time.
 *
 * **This fails closed, and that is the whole point of it.** Upstream returns
 * claims, not a user record, so the subject has to be resolved here. If the
 * `sub` claim is missing, does not name a user row, or the lookup throws, the
 * caller is REJECTED. Falling through to `mapUserRoleToMcpRole`'s `member`
 * default in those branches would promote an unidentifiable caller to a writing
 * role and widen the tool surface, with nothing in the response revealing it.
 *
 * The `member` default survives only where it is safe: a row that exists and
 * carries a role string Sovrium does not recognise. That is Better Auth's own
 * default role for a freshly-registered user and matches `buildGetSession`.
 */
const bridgeClaimsToCaller = async (
  claims: Readonly<JWTPayload>
): Promise<McpCaller | undefined> => {
  const subject = typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : undefined
  if (subject === undefined) return undefined

  try {
    const users = authUsersTable()
    const rows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, subject))
      .limit(1)
    const row = rows[0]
    // No user row for this subject: reject. Do NOT fall back to a role.
    if (row === undefined) return undefined
    return { role: mapUserRoleToMcpRole(row.role ?? undefined), userId: subject }
  } catch {
    // A lookup failure leaves the caller unidentified, which is the same
    // position as an unknown subject. Surfaced as 401 rather than 500 so a
    // database blip does not leak infrastructure detail to MCP clients.
    return undefined
  }
}

/**
 * The 401 used where upstream has not authored one: the API-key path, whose
 * rejections come back as a thrown `APIError` or a null session rather than as
 * a Response, and a verified OAuth token whose subject the role bridge refused.
 */
const buildUnauthenticatedResponse = (): Response =>
  new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      // JSON-RPC 2.0 §5: a response to a request whose id could not be
      // determined MUST carry a null id.
      id: JSONRPC_NULL_ID,
      error: { code: -32_000, message: 'Unauthorized' },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )

/**
 * Extract the raw bearer token from the `Authorization` header, or `undefined`
 * if the header is missing / malformed. Exposed so the dispatcher can pass the
 * value through to the SDK's `authInfo.token` without duplicating the regex.
 */
export const readBearerToken = (c: Readonly<Context>): string | undefined => {
  const authHeader = c.req.header('Authorization') ?? ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  return bearerMatch?.[1]
}

const mapUserRoleToMcpRole = (role: string | undefined): McpCallerRole => {
  if (isAdminRole(role)) return 'admin'
  if (role === 'viewer') return 'viewer'
  // 'member' is the default Better Auth role; any unknown role on an EXISTING
  // user row falls back to member rather than 401-ing the request, matching
  // `buildGetSession`. An ABSENT row never reaches here — see
  // `bridgeClaimsToCaller`.
  return 'member'
}

/**
 * Derive the origin the MCP client used to reach this server. `BASE_URL` is not
 * usable for the self-directed HTTP calls above: a server started with `PORT=0`
 * is assigned its real port after the base URL is computed, so the configured
 * value points at port 0. The request URL is what the client actually
 * addressed.
 */
const resolveRequestOrigin = (c: Readonly<Context>): string => {
  try {
    const url = new URL(c.req.url)
    return `${url.protocol}//${url.host}`
  } catch {
    return `http://localhost:${process.env['PORT'] ?? '3000'}`
  }
}
