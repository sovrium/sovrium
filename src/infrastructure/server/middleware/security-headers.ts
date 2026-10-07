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
 *    Keep this example pointing at a route that exists: a reader checking
 *    whether the looser direction is ever used would otherwise find nothing,
 *    and conclude the wrong thing about which of the two directions is
 *    load-bearing.
 *
 * A route that says nothing keeps the platform default —
 * `frame-ancestors 'none'` + `X-Frame-Options: DENY` — so the safe answer
 * remains the one you get by not thinking about it.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  let routeHeaders: ReadonlyArray<readonly [string, string]> = []
  let routeGrants: string | undefined = undefined
  await structuralSecureHeaders(c, async () => {
    await next()
    routeHeaders = ROUTE_OVERRIDABLE_HEADERS.flatMap((name) => {
      const value = c.res.headers.get(name)
      return value === null ? [] : [[name, value] as const]
    })
    routeGrants = c.res.headers.get('Permissions-Policy') ?? undefined
  })

  routeHeaders.forEach(([name, value]) => c.res.headers.set(name, value))
  const structuralPolicy = c.res.headers.get('Permissions-Policy')
  if (routeGrants !== undefined && structuralPolicy !== null) {
    c.res.headers.set('Permissions-Policy', grantPermissions(structuralPolicy, routeGrants))
  }
}

/** The feature a Permissions-Policy directive names (`microphone=(self)` → `microphone`). */
const featureOf = (directive: string): string => directive.split('=')[0]?.trim() ?? ''

/**
 * Merge a route's Permissions-Policy GRANTS into the structural policy.
 *
 * A page that genuinely uses a powerful feature — a form field with
 * `recordAudio`, a chat with `voiceInput` — answers with only the directive it
 * needs (`microphone=(self)`). Each such directive REPLACES the structural
 * directive of the same feature; every other feature keeps its structural
 * denial, and a route cannot introduce a feature the structural policy does
 * not name. So the grant is per page, per feature, and nothing else widens:
 * `/api/health`, a 404, and any page without a recorder still say
 * `microphone=()`.
 */
const grantPermissions = (structural: string, grants: string): string => {
  const granted = new Map(
    grants
      .split(',')
      .map((directive) => directive.trim())
      .filter((directive) => directive.includes('='))
      .map((directive) => [featureOf(directive), directive] as const)
  )
  return structural
    .split(',')
    .map((directive) => directive.trim())
    .map((directive) => granted.get(featureOf(directive)) ?? directive)
    .join(', ')
}
