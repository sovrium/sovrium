/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure same-origin validation for caller-supplied redirect targets.
 *
 * Every redirect target that reaches a navigation sink — `location.assign`,
 * `location.href`, or a server-side `c.redirect(...)` — must be proven to stay
 * on this origin before it is used. The values arrive from places a visitor can
 * influence: DOM `data-*` attributes, `_redirect` form fields, and config path
 * templates interpolated with record data that any writer can set.
 *
 * The naive check this replaces was `value.startsWith('/')`. That test is
 * necessary but nowhere near sufficient, because the URL parser resolves
 * several `/`-leading forms to a *different* origin:
 *
 *  - `//evil.com`     — protocol-relative; inherits the current scheme.
 *  - `/\evil.com`     — backslashes are normalised to `/` for special schemes,
 *                       so this is `//evil.com` by the time it is resolved.
 *  - `/<TAB>/evil.com` — tab, LF and CR are stripped from a URL *anywhere* in
 *                       the string, so this collapses to `//evil.com` too.
 *
 * Rather than enumerate those forms and hope the list is complete, the check is
 * closed by construction: resolve the candidate against a fixed synthetic base
 * with the same WHATWG URL parser the browser and the HTTP client use, then
 * require the resulting origin to be unchanged. Any form that escapes the
 * origin fails, including forms not yet invented. The explicit `//` and `/\`
 * rejections above it are redundant with that check and kept only because they
 * state the intent at a glance.
 *
 * Note that `javascript:` and `data:` payloads were already excluded by the
 * leading-`/` requirement (a scheme cannot follow a slash) and remain so: a
 * value like `/javascript:alert(1)` resolves to an ordinary same-origin path.
 * The vulnerability class this closes is open redirect, not XSS.
 *
 * This is the single canonical redirect-target check — never add a second one,
 * and never re-inline a bare `startsWith('/')` at a navigation sink.
 */

/**
 * Synthetic base used only to resolve candidates. The `.invalid` TLD is
 * reserved by RFC 2606 and can never be a real host, so a candidate that
 * somehow resolves against it still cannot name a reachable origin. No DNS
 * lookup occurs — URL parsing is purely lexical.
 */
const SAFE_ORIGIN = 'https://sovrium.invalid'

/**
 * True when `value` is a redirect target that provably stays on the current
 * origin: a non-empty absolute path (`/dashboard`, `/users/42?tab=1#top`) that
 * the URL parser resolves without changing the origin.
 *
 * Returns `false` for absolute URLs, protocol-relative URLs, scheme-bearing
 * values, and anything that is not a non-empty string — callers treat `false`
 * as "do not navigate" and fall through to their existing default.
 */
export const isSafeRedirectPath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value === '') return false
  if (!value.startsWith('/')) return false
  // Redundant with the origin check below, but states the two best-known
  // escapes explicitly at the point a reader looks for them.
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  try {
    return new URL(value, `${SAFE_ORIGIN}/`).origin === SAFE_ORIGIN
  } catch {
    // A candidate the parser rejects outright is not a usable target either.
    return false
  }
}

/**
 * The same-origin path `value` denotes, rebuilt by the URL parser, or
 * `undefined` when it is not a safe target.
 *
 * The projection of {@link isSafeRedirectPath} that navigation sinks should
 * use. It answers the same question, but hands back a value the parser BUILT
 * rather than the caller's original string, which matters twice over:
 *
 *  - Normalisation. Tab, LF and CR are stripped, `..` segments are resolved,
 *    and non-ASCII is percent-encoded — so the string assigned to `location` is
 *    the one the browser was going to compute anyway, decided here where it can
 *    be tested rather than inside the navigation.
 *  - Provenance. The result always begins with `/`, by construction of
 *    `URL.pathname`, so it cannot carry a `javascript:` or `data:` scheme. That
 *    property holds without the reader having to trace the guard, and it is
 *    what static analysis can see: CodeQL does not model a cross-module type
 *    guard as a sanitizer, so passing the raw DOM attribute to
 *    `location.assign` reads to it as an unguarded sink (alert #34).
 *
 * The safety decision itself is unchanged and still lives in one place — this
 * delegates to the predicate rather than re-deriving it.
 */
export const toSafeRedirectPath = (value: unknown): string | undefined => {
  if (!isSafeRedirectPath(value)) return undefined
  try {
    const url = new URL(value, `${SAFE_ORIGIN}/`)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    // Unreachable: the predicate already parsed this value against the same
    // base. Kept so a future change to either side cannot throw at a sink.
    return undefined
  }
}
