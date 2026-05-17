/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { type Context } from 'hono'
import { oauthAccessTokens, users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import type { McpAuthStrategy } from '@/domain/models/env/mcp'

/**
 * MCP authentication helpers.
 *
 * Split from `mcp-routes.ts` to keep both modules under the project-wide
 * 400-line max-lines limit. Two responsibilities live here:
 *
 *  1. **Bearer-token resolution**: read the `Authorization` header, dispatch
 *     to either the static-token gate (M-1 keystone, `MCP_TOKEN_*`) or the
 *     OAuth-server-issued bearer gate (M-5, this slice).
 *  2. **WWW-Authenticate construction**: build the RFC 9728-shaped 401
 *     response that points OAuth-aware MCP clients to the discovery
 *     endpoints (`/.well-known/oauth-authorization-server` for RFC 8414,
 *     `/.well-known/oauth-protected-resource` for the resource-server
 *     metadata).
 */

/**
 * Caller role derived from the bearer token. Drives `tools/list` filtering
 * downstream — viewers see no `_create / _update / _delete` tools, members
 * see a permitted subset, admins see the full surface.
 */
export type McpCallerRole = 'admin' | 'member' | 'viewer'

/**
 * Resolved caller identity. The `userId` is populated only in `oauth2`
 * strategy (the bearer maps to a real Better Auth user). Static-token
 * strategy returns `userId: undefined` because operator-issued tokens
 * have no per-user identity — Z-3 row-level enforcement (which needs a
 * userId for `user_access` lookups) is skipped in that case.
 */
export interface McpCaller {
  readonly role: McpCallerRole
  readonly userId: string | undefined
}

/**
 * Subset of the resolved MCP env config that the auth helpers need. Keeping
 * the dependency narrow makes the helpers easier to test in isolation.
 */
export interface McpAuthConfig {
  readonly authStrategy: McpAuthStrategy
  readonly tokenAdmin: string | undefined
  readonly tokenMember: string | undefined
  readonly tokenViewer: string | undefined
}

/**
 * Resolve the caller's role from the bearer token. Returns `undefined` when
 * the request has no Authorization header, the bearer doesn't match any
 * configured token (in `token` strategy), or the OAuth access token is
 * unknown / expired / inactive (in `oauth2` strategy).
 *
 * The two strategies are mutually exclusive at runtime — `oauth2` skips the
 * static-token comparison entirely, and vice versa. This avoids a foot-gun
 * where an operator partially configures both modes and unintentionally
 * leaves a bypass open.
 */
export const resolveCallerRole = async (
  c: Readonly<Context>,
  config: McpAuthConfig
): Promise<McpCallerRole | undefined> => {
  const caller = await resolveCaller(c, config)
  return caller?.role
}

/**
 * Resolve the caller's role AND optional userId from the bearer token.
 *
 * Mirrors `resolveCallerRole` but additionally returns the Better Auth user
 * id when the strategy is `oauth2` and the bearer is a valid OAuth access
 * token. The userId is required by Z-3 row-level enforcement (M-6) so MCP
 * `tools/call` can run `loadCurrentUserContext` against the same
 * `user_access` rows the human-session HTTP layer reads.
 *
 * Static-token strategy returns `userId: undefined` because operator-issued
 * tokens have no per-user identity. Z-3 enforcement is skipped in that case
 * — the connecting role's RBAC is the only authority.
 */
export const resolveCaller = async (
  c: Readonly<Context>,
  config: McpAuthConfig
): Promise<McpCaller | undefined> => {
  const presented = readBearerToken(c)
  if (!presented) return undefined

  if (config.authStrategy === 'oauth2') {
    return resolveOauthCaller(presented)
  }
  const role = resolveStaticTokenRole(presented, config)
  if (role === undefined) return undefined
  return { role, userId: undefined }
}

/**
 * Extract the raw bearer token from the `Authorization` header, or
 * `undefined` if the header is missing / malformed. Exposed so the
 * rate-limit middleware can key per-token in `token` strategy without
 * duplicating the regex.
 */
export const readBearerToken = (c: Readonly<Context>): string | undefined => {
  const authHeader = c.req.header('Authorization') ?? ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  return bearerMatch?.[1]
}

const resolveStaticTokenRole = (
  presented: string,
  config: McpAuthConfig
): McpCallerRole | undefined => {
  if (presented === config.tokenAdmin) return 'admin'
  if (presented === config.tokenMember) return 'member'
  if (presented === config.tokenViewer) return 'viewer'
  return undefined
}

/**
 * Validate an OAuth access token by looking it up in `auth.oauth_access_token`
 * and resolving the issuing user's role.
 *
 * The Better Auth oauth-provider plugin stores tokens in the database as
 * SHA-256 / base64url(no padding) digests of the raw bearer (default
 * `storeTokens: 'hashed'` mode — see
 * `node_modules/@better-auth/oauth-provider/dist/utils-*.mjs#defaultHasher`).
 * To validate an incoming bearer we therefore hash it the same way and look
 * the digest up in the table.
 *
 * The token row carries an `expiresAt` (set by the plugin to now+1h by
 * default). Rows past their expiry are treated as inactive — RFC 7662
 * introspection semantics translate "active=false" to "401 Unauthorized" at
 * the MCP boundary. Revoked tokens are deleted from the table by the plugin's
 * `/revoke` handler, so missing rows are also inactive.
 *
 * Role mapping mirrors `buildGetSession` in server.ts: `auth.user.role` is
 * propagated as-is when it matches one of `admin / viewer`; anything else
 * (including null / unset) defaults to `member` so a freshly-registered user
 * with no admin elevation can still drive non-mutating tools.
 */
/**
 * Look up an OAuth bearer token in `auth.oauth_access_token` and resolve
 * the issuing user's role + userId. Returns `undefined` when the token is
 * unknown / expired / revoked. The userId is essential for M-6 Z-3
 * row-level enforcement at `tools/call` time.
 */
const resolveOauthCaller = async (token: string): Promise<McpCaller | undefined> => {
  try {
    const hashed = await hashAccessToken(token)
    const rows = await db
      .select({ userId: oauthAccessTokens.userId, expiresAt: oauthAccessTokens.expiresAt })
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.token, hashed))
      .limit(1)
    const accessToken = rows[0]
    if (!accessToken) return undefined
    if (accessToken.expiresAt.getTime() <= Date.now()) return undefined
    if (!accessToken.userId) return undefined

    const userRows = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, accessToken.userId))
      .limit(1)
    const userRole = userRows[0]?.role ?? undefined
    return { role: mapUserRoleToMcpRole(userRole), userId: accessToken.userId }
  } catch {
    // DB lookup failures are surfaced as 401 (rather than 500) to avoid
    // leaking infrastructure errors to MCP clients. The audit / metrics
    // pipelines pick up the underlying failure separately.
    return undefined
  }
}

/**
 * Hash a raw OAuth access token to its database-stored form. Mirrors the
 * Better Auth oauth-provider plugin's `defaultHasher`: SHA-256 of the UTF-8
 * bytes, then base64url-encoded with no padding. Kept private to this module
 * — the hashing convention is an internal contract between Better Auth and
 * any code that reads `auth.oauth_access_token.token` directly.
 */
const hashAccessToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return base64UrlEncode(new Uint8Array(digest))
}

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const mapUserRoleToMcpRole = (role: string | undefined): McpCallerRole => {
  if (role === 'admin') return 'admin'
  if (role === 'viewer') return 'viewer'
  // 'member' is the default Better Auth role; any unknown role falls back
  // to member rather than 401-ing the request, matching `buildGetSession`.
  return 'member'
}

/**
 * Build the `WWW-Authenticate` header value for a 401 from `/mcp` in
 * `oauth2` strategy. Returns `undefined` for `token` strategy (there is no
 * authorization server to advertise).
 *
 * The header carries two RFC discovery hints:
 *
 *   - `as_uri` — RFC 8414 authorization-server metadata (so the client can
 *     find the authorization, token, and registration endpoints)
 *   - `resource_metadata` — RFC 9728 protected-resource metadata (so the
 *     client knows which authorization servers issue tokens for /mcp and
 *     which transport methods are accepted)
 */
export const buildOauthWwwAuthenticate = (
  c: Readonly<Context>,
  config: McpAuthConfig
): string | undefined => {
  if (config.authStrategy !== 'oauth2') return undefined
  const baseUrl = resolveBaseUrl(c)
  return (
    `Bearer realm="mcp", ` +
    `as_uri="${baseUrl}/.well-known/oauth-authorization-server", ` +
    `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
  )
}

/**
 * Derive the base URL the MCP client used to reach this server. We can't
 * rely on `process.env.BASE_URL` because Bun-spawned test servers run on
 * dynamically-assigned ports (PORT=0). The request URL is what the client
 * actually addressed; the protocol is whatever Hono received the request
 * over (defaults to http when no `x-forwarded-proto` is set).
 */
const resolveBaseUrl = (c: Readonly<Context>): string => {
  const explicit = process.env['BASE_URL']
  if (explicit && explicit.length > 0) return explicit
  try {
    const url = new URL(c.req.url)
    return `${url.protocol}//${url.host}`
  } catch {
    return `http://localhost:${process.env['PORT'] ?? '3000'}`
  }
}
