/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `Vary: Accept-Language` — declared exactly where the header steered the
 * response.
 *
 * ## The rule
 *
 * A response carries `Vary: Accept-Language` if and only if `Accept-Language`
 * participated in choosing WHAT was sent. That is a narrow set:
 *
 *  - the root `/` — BOTH branches. The 302 to `/{lang}/` obviously negotiates,
 *    but so does the 200: it is served with `Cache-Control: public, max-age=300`
 *    and is what an English visitor gets *instead of* a redirect, so a shared
 *    cache that stores it under the bare `/` key hands the English document to
 *    a French visitor whose redirect then never runs at all;
 *  - the unprefixed-path language fallback 302, whose target is chosen from the
 *    header outright;
 *  - the trailing-slash 301, but ONLY on the branch where the stripped path is
 *    reachable via that same language fallback. A 301 is heuristically
 *    cacheable and browsers keep it near-permanently, so mislabelling it is the
 *    most operationally damaging of the three.
 *
 * ## Why not in `securityHeaders`
 *
 * That is a `use('*')`, so it would stamp `Vary` on every PNG, stylesheet and
 * API response — multiplying every CDN cache key by an unbounded header
 * cardinality for responses that never read the header. `Vary` is a cache
 * contract, not a security header, and blanket-applying it is a capacity
 * regression disguised as correctness.
 *
 * ## Append, never overwrite
 *
 * `Vary` is a comma-separated list and other layers may legitimately add to it
 * (`Accept-Encoding`, `Cookie`). Setting it would silently drop theirs, so this
 * appends and lets the HTTP layer join the values.
 */

import type { Context } from 'hono'

/** The request header whose value steers language-negotiated responses. */
const ACCEPT_LANGUAGE = 'Accept-Language'

/**
 * Declare that this response varies on `Accept-Language`.
 *
 * Must be called BEFORE `c.redirect(...)` / `c.html(...)`: it writes into
 * Hono's prepared headers, which seed the response those helpers construct.
 *
 * @param c - The Hono request context.
 */
export function varyOnAcceptLanguage(
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): void {
  c.header('Vary', ACCEPT_LANGUAGE, { append: true })
}
