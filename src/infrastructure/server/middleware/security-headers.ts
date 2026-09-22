/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { secureHeaders } from 'hono/secure-headers'
import type { MiddlewareHandler } from 'hono'

/**
 * Platform-wide security response headers, applied as the first `*` middleware
 * so every response (page, API, asset, 404) carries them. Hono's defaults
 * cover X-Content-Type-Options and COOP/CORP; this adds HSTS, Referrer-Policy,
 * Permissions-Policy, an ENFORCED structural Content-Security-Policy and an
 * explicit `X-Frame-Options: DENY`.
 *
 * The CSP is ENFORCED but carries ONLY the structural directives that do not
 * touch inline content and have effectively zero legitimate-traffic blast
 * radius: `frame-ancestors 'none'` (real clickjacking protection — it is
 * *ignored* in a report-only policy, so it only bites when enforced),
 * `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`. It
 * deliberately OMITS `default-src`/`script-src`/`style-src`, so the SSR layer's
 * inline `<script>`/`<style>` blocks keep working — `frame-ancestors`,
 * `base-uri` and `form-action` do not inherit from `default-src`, and
 * `object-src` is set explicitly, so no fetch directive falls back to a
 * missing `default-src`.
 *
 * There is intentionally NO interim `Content-Security-Policy-Report-Only`
 * header. A report-only policy with no `report-to`/`report-uri` sink collects
 * nothing and only emits browser console warnings, so it is not shipped.
 * Enforcing `script-src`/`style-src` is a scoped Phase 2 follow-up using
 * per-request nonces (`hono/secure-headers` `NONCE`), which requires threading
 * a nonce through every inline SSR emit point first — see
 * `[internal ref]`.
 *
 * `X-Frame-Options: DENY` is set explicitly to align the legacy anti-framing
 * header with the enforced `frame-ancestors 'none'` (Hono's default is the
 * weaker `SAMEORIGIN`).
 *
 * Permissions-Policy denies powerful features the platform does not use (an
 * empty array disables the feature for every origin). Emitting it in code means
 * the header does not depend on the host ingress (Caddy) security-header
 * backstop at `[internal ref]` being attached.
 *
 *.
 */
const structuralSecureHeaders = secureHeaders({
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  referrerPolicy: 'strict-origin-when-cross-origin',
  xFrameOptions: 'DENY',
  contentSecurityPolicy: {
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    accelerometer: [],
    gyroscope: [],
    magnetometer: [],
  },
})

/**
 * The framing headers a route may override, and the CSP.
 *
 * `X-Frame-Options` joins the CSP here because the two express ONE decision in
 * two vocabularies: a route that has decided it may be framed has to say so in
 * both, or a browser honouring the legacy header refuses what the modern one
 * allows.
 */
const ROUTE_OVERRIDABLE_HEADERS = ['Content-Security-Policy', 'X-Frame-Options'] as const

/**
 * Wraps the structural `secureHeaders` middleware so that a per-route framing
 * decision set by a downstream handler is NOT clobbered by the platform-wide
 * structural policy.
 *
 * `hono/secure-headers` applies its headers in the POST-`next()` phase
 * (`setHeaders` → `ctx.res.headers.set(…)`), so a route handler that sets its
 * own policy on the response it returns would be overwritten by the structural
 * middleware, which is registered as the first `*` middleware. Here we capture
 * whatever the handler produced (inside the inner `next()`, before the
 * structural phase runs) and restore it afterwards.
 *
 * ## This is not a hole; it is where a framing decision belongs
 *
 * Both directions of override are legitimate, and both are in use:
 *
 *  - **Stricter.** The signed bucket-download path streams untrusted bytes
 *    under `default-src 'none'`, which must survive.
 *  - **Looser, and narrowly.** The design-system viewport frames
 *    (`/_admin/design-system/component-frame/:name`) exist to be embedded by
 *    the console page framing them, so they answer with `frame-ancestors 'self'`
 *    and the matching `SAMEORIGIN`. That is not a weakening of clickjacking
 *    protection: the route sits behind the console's own admin guard (404 for
 *    everyone else), and `'self'` still refuses every origin an attacker could
 *    control without already controlling this app.
 *
 *    This example named `/_admin/design-system/preview/:section` until
 *    2026-09-17. Those routes were deleted in `36c9914678`, which left the
 *    looser direction documented by a route that no longer existed — a reader
 *    checking whether the mechanism had ever been used would have found
 *    nothing, and concluded the wrong thing about which of the two directions
 *    is load-bearing.
 *
 * A route that says nothing keeps the platform default —
 * `frame-ancestors 'none'` + `X-Frame-Options: DENY` — so the safe answer
 * remains the one you get by not thinking about it.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  // eslint-disable-next-line functional/no-let
  let routeHeaders: ReadonlyArray<readonly [string, string]> = []
  // eslint-disable-next-line functional/no-expression-statements
  await structuralSecureHeaders(c, async () => {
    await next()
    // eslint-disable-next-line functional/no-expression-statements
    routeHeaders = ROUTE_OVERRIDABLE_HEADERS.flatMap((name) => {
      const value = c.res.headers.get(name)
      return value === null ? [] : [[name, value] as const]
    })
  })

  routeHeaders.forEach(([name, value]) => c.res.headers.set(name, value))
}
