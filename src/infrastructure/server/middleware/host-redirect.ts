/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MiddlewareHandler } from 'hono'

/**
 * Retired-host → canonical-path 301 redirect middleware.
 *
 * A generic Sovrium engine capability for the "we merged a retired subdomain
 * into one unified app" migration: when a self-hoster folds an old host
 * (e.g. `docs.example.com`) into a single app that now serves that content
 * under a path prefix (e.g. `/en/docs`), every indexed URL on the retired host should
 * issue a real, path-preserving `301 Moved Permanently` so link equity
 * transfers cleanly.
 *
 * This is a HOSTING/OPERATOR concern (which domains a given deployment merged
 * during migration), NOT app/business intent — so it is env-var-gated here in
 * the shared server composition root rather than expressed in `AppConfig`
 * schema. Two operators running the SAME app config in different environments
 * have different domain-merge histories, so this must stay out of the schema.
 *
 * Env-var contract (both must be set to activate — otherwise a complete no-op):
 * - `SOVRIUM_REDIRECT_HOST` — the retired hostname to match, compared
 *   case-insensitively against the incoming `X-Forwarded-Host` (falling back
 *   to `Host`), with any `:port` suffix stripped before comparing.
 * - `SOVRIUM_REDIRECT_HOST_TARGET` — the path prefix to redirect matched
 *   requests under (e.g. `/en/docs`; no trailing slash).
 *
 * The 301 origin is resolved like `resolveBaseUrl` in `seo-routes.ts`: prefer
 * the operator's canonical `BASE_URL`, else derive `${proto}://${host}` from
 * the incoming request. In production `BASE_URL` is the canonical app origin,
 * so a request to the retired host redirects to the canonical host + path
 * prefix, path- and query-string-preserving.
 *
 * When unset, this is a zero-blast-radius no-op — it never affects any other
 * spec or deployment.
 */

const REDIRECT_HOST_ENV = 'SOVRIUM_REDIRECT_HOST'
const REDIRECT_HOST_TARGET_ENV = 'SOVRIUM_REDIRECT_HOST_TARGET'

/**
 * Normalize a `Host` / `X-Forwarded-Host` header value for comparison:
 * take the first entry (`X-Forwarded-Host` may be comma-joined by chained
 * proxies), strip any `:port` suffix, trim, and lowercase.
 *
 * Returns `undefined` for an absent/empty header so a missing host never
 * matches a configured host.
 */
export const normalizeHostHeader = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined
  const first = raw.split(',')[0]?.trim()
  if (!first) return undefined
  const withoutPort = first.split(':')[0]
  return withoutPort ? withoutPort.toLowerCase() : undefined
}

/**
 * Inputs for the pure redirect decision. All values are explicit so the
 * "should this host redirect, and to what Location" logic is unit-testable
 * without a live server.
 */
export interface HostRedirectInputs {
  /** Raw incoming host — `X-Forwarded-Host` ?? `Host`. */
  readonly requestHost: string | undefined
  /** Incoming URL pathname — e.g. `/` or `/getting-started`. */
  readonly requestPath: string
  /** Incoming URL search string incl. leading `?` (or `''`) — e.g. `?a=1`. */
  readonly requestSearch: string
  /** Configured retired host (`SOVRIUM_REDIRECT_HOST`) or `undefined` when unset. */
  readonly configuredHost: string | undefined
  /** Configured target path prefix (`SOVRIUM_REDIRECT_HOST_TARGET`) or `undefined`. */
  readonly targetPrefix: string | undefined
  /** Canonical app origin (no trailing slash) to build the absolute Location. */
  readonly resolvedOrigin: string
}

/**
 * Pure redirect decision.
 *
 * Returns the absolute 301 `Location` when the request host matches the
 * configured retired host, or `undefined` when the feature is unconfigured or
 * the host does not match (caller should then call `next()`).
 *
 * Location shape — path-preserving, query-preserving, no double slash at root:
 *   `${origin}${targetPrefix}${path === '/' ? '' : path}${search}`
 * so `/` → `${origin}${targetPrefix}` (exactly, no trailing slash) and
 * `/getting-started?x=1` → `${origin}${targetPrefix}/getting-started?x=1`.
 */
export const resolveHostRedirect = (inputs: HostRedirectInputs): string | undefined => {
  const { configuredHost, targetPrefix } = inputs
  if (!configuredHost || !targetPrefix) return undefined

  const host = normalizeHostHeader(inputs.requestHost)
  if (!host || host !== configuredHost.toLowerCase()) return undefined

  const appendedPath = inputs.requestPath === '/' ? '' : inputs.requestPath
  return `${inputs.resolvedOrigin}${targetPrefix}${appendedPath}${inputs.requestSearch}`
}

/**
 * Resolve the canonical origin for the 301 target, mirroring `resolveBaseUrl`
 * in `seo-routes.ts`:
 *  1. `BASE_URL` env var — the canonical production origin (primary source: the
 *     redirect must point at the canonical app host, never the retired host).
 *  2. Fallback — derive `${proto}://${host}` from the incoming request when
 *     `BASE_URL` is unset (degenerate for a same-host redirect, but this is the
 *     documented fallback; operators are expected to set `BASE_URL`).
 *
 * The trailing slash (if any) is trimmed so the caller can append the path.
 */
const resolveRedirectOrigin = (host: string | undefined, forwardedProto?: string): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (host) {
    const proto = forwardedProto || 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  return ''
}

/**
 * Hono middleware wiring the pure decision above into the request pipeline.
 *
 * Mounted EARLY in `createHonoApp` (right after `requestId()` + `securityHeaders`)
 * so it short-circuits with the 301 before any downstream routing when the host
 * matches. Method-agnostic (GET/HEAD is the only realistic retired-host traffic).
 */
export const hostRedirect: MiddlewareHandler = async (c, next) => {
  const configuredHost = Bun.env[REDIRECT_HOST_ENV]
  const targetPrefix = Bun.env[REDIRECT_HOST_TARGET_ENV]
  // Fast no-op when unconfigured — zero blast radius on every other deployment.
  if (!configuredHost || !targetPrefix) return next()

  const rawHost = c.req.header('X-Forwarded-Host') ?? c.req.header('Host')
  const url = new URL(c.req.url)
  const location = resolveHostRedirect({
    requestHost: rawHost,
    requestPath: url.pathname,
    requestSearch: url.search,
    configuredHost,
    targetPrefix,
    resolvedOrigin: resolveRedirectOrigin(rawHost, c.req.header('X-Forwarded-Proto')),
  })

  return location === undefined ? next() : c.redirect(location, 301)
}
