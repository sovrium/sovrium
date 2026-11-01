/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a stored credential may be sent. A connection's credential belongs to
 * one service, whose address the configuration declares; a request that names
 * another site, whether by mistake or because a caller chose the address, must
 * not carry it.
 */

/** The origin (`scheme://host[:port]`) of an `http:` or `https:` URL, or `undefined`. */
export const httpOriginOf = (url: string): string | undefined => {
  const parsed = URL.parse(url)
  if (parsed === null) return undefined
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined
}

/**
 * Whether `requestUrl` goes to the same origin as `baseUrl`: same scheme, same
 * host, same port (a default port and no port are the same). Anything that is
 * not an http(s) URL matches nothing.
 */
export const isSameHttpOrigin = (requestUrl: string, baseUrl: string): boolean => {
  const request = httpOriginOf(requestUrl)
  return request !== undefined && request === httpOriginOf(baseUrl)
}

/** A `$env.NAME` reference, bare or as a `{{ $env.NAME }}` expression: the operator's own value. */
const ENV_REFERENCE = /\{\{\s*\$env\.\w+\s*\}\}|\$env\.[A-Z][A-Z0-9_]*/g

/** A URL that starts with one environment reference, which then supplies its scheme and host. */
const LEADING_ENV = /^\uE000/

/** The scheme and authority of a URL as written: `https://user@host:port`. */
const SCHEME_AND_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i

/**
 * Whether an authored request URL fixes its scheme, host and port in the
 * configuration, so no run-data value can change which site it reaches.
 *
 * Fixed: a literal `https://api.example.com/{{trigger.id}}`, and a URL whose
 * site comes from an environment variable (`$env.API_URL/items`, and so
 * `$env.API_URL{{path}}` too: a run-time check holds what follows it). Not fixed: a
 * URL that is one template (`{{trigger.query.url}}`), or any template written
 * before the path begins (`https://{{trigger.tenant}}.example.com`,
 * `https://api.example.com{{trigger.suffix}}`).
 */
export const hasConfigFixedHost = (authored: string): boolean => {
  const text = authored.trim().replace(ENV_REFERENCE, '\uE000')
  // The operator's variable supplies the site; what follows it is read as the
  // path, and the run checks the origin it resolves to before sending.
  if (LEADING_ENV.test(text)) return true
  const site = SCHEME_AND_AUTHORITY.exec(text)?.[0]
  return site !== undefined && !site.includes('{{')
}
