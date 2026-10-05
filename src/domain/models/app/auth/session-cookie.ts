/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The session cookie's name — one constant for the side that SETS it and the
 * side that recognises it.
 *
 * Better Auth names its session cookie `<cookiePrefix>.session_token`, with
 * `__Secure-` in front when secure cookies are on (every non-loopback bind).
 * The auth instance pins `advanced.cookiePrefix` to {@link AUTH_COOKIE_PREFIX},
 * and the request-credential predicate builds its match from the same
 * constant: were the two to drift, a signed-in request would carry a cookie
 * the predicate does not recognise, and the API would skip its session lookup
 * and answer it as anonymous.
 */

/** The `advanced.cookiePrefix` the auth instance is configured with. */
export const AUTH_COOKIE_PREFIX = 'better-auth'

/** The session cookie's base name, before any `__Secure-` / `__Host-` prefix. */
export const SESSION_COOKIE_NAME = `${AUTH_COOKIE_PREFIX}.session_token`

/** The browser-enforced name prefixes a cookie can carry in front of its name. */
const SECURITY_PREFIXES = ['', '__Secure-', '__Host-'] as const

const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set(
  SECURITY_PREFIXES.map((prefix) => `${prefix}${SESSION_COOKIE_NAME}`)
)

/**
 * Whether a `Cookie` header carries the session cookie, under any of its
 * names. Matched by exact name: a language, consent or active-assignment
 * cookie is not a session, and neither is a cookie whose name merely CONTAINS
 * the session cookie's.
 */
export const hasSessionCookie = (cookieHeader: string | undefined): boolean =>
  (cookieHeader ?? '').split(';').some((pair) => {
    const separator = pair.indexOf('=')
    return separator !== -1 && SESSION_COOKIE_NAMES.has(pair.slice(0, separator).trim())
  })
