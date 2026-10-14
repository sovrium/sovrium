/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a page action's next address leads, resolved against the page it was
 * written on — the one rule the browser runtimes and the server share.
 *
 * Kept apart from `redirect-safety.ts`, the check every navigation sink runs:
 * that module is in the mount cost of every island that follows a link, and
 * only the few that resolve an action's address need this one.
 */

import { SAFE_ORIGIN, toSafeRedirectPath } from './redirect-safety'

/**
 * `value` resolved against the page that asked for it, as a safe same-origin
 * path — or `undefined` when it names another site or is not an address.
 *
 * A page action may write its next address relative to the page it is on —
 * `preview`, `?saved=1`, `#comments` — exactly as a link may, and a page post
 * carries that address to the server as written. Only the PATH and query of
 * `page` are read (a `Referer` header names a full URL): the result is a path
 * on this site whatever `page` says. The resolved path then goes through
 * {@link toSafeRedirectPath}, the one check.
 *
 * `siteOrigin` is the origin the caller KNOWS it is on — the browser's
 * `location.origin`. Given one, an address written in full on that very origin
 * (`https://app.example/invoices/7`, as an API may answer it) is that path;
 * without one (the server, which cannot trust its own idea of its public
 * origin behind a proxy) every absolute address is refused. Any address that
 * resolves to another origin (`https://elsewhere.example`, `//elsewhere.example`,
 * `\\elsewhere.example`) or carries credentials is refused in both cases. The
 * browser runtimes and the server share this one function, so the rule cannot
 * drift between them.
 */
export const resolveRedirectAgainst = (
  value: unknown,
  page: string | undefined,
  siteOrigin?: string
): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    const here = new URL(page ?? '/', `${SAFE_ORIGIN}/`)
    const origin = siteOrigin === undefined ? SAFE_ORIGIN : new URL(siteOrigin).origin
    const resolved = new URL(value, `${origin}${here.pathname}${here.search}`)
    if (resolved.origin !== origin || resolved.username !== '' || resolved.password !== '') {
      return undefined
    }
    return toSafeRedirectPath(resolved.href.slice(origin.length))
  } catch {
    // An address, a page or an origin the parser rejects is no target.
    return undefined
  }
}

/**
 * True when the same-site path `target` names another document than `page`: a
 * different path or query. A `#fragment` on the same page stays. Only the path
 * and query of `page` are read, as in {@link resolveRedirectAgainst}.
 */
export const isAnotherDocument = (target: string, page: string): boolean => {
  try {
    const next = new URL(target, `${SAFE_ORIGIN}/`)
    const here = new URL(page, `${SAFE_ORIGIN}/`)
    return next.pathname + next.search !== here.pathname + here.search
  } catch {
    // Not an address: nothing to leave for.
    return false
  }
}
