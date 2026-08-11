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
 * Wraps the structural `secureHeaders` middleware so that a stricter,
 * per-route `Content-Security-Policy` set by a downstream handler is NOT
 * clobbered by the platform-wide structural CSP.
 *
 * `hono/secure-headers` applies its headers in the POST-`next()` phase
 * (`setHeaders` → `ctx.res.headers.set('Content-Security-Policy', …)`), so when
 * a route handler sets its own CSP on the response it returns (e.g. the signed
 * bucket-download path streams bytes under `default-src 'none'`), the
 * structural middleware — registered as the first `*` middleware — would
 * overwrite it with the looser structural policy. Here we capture whatever CSP
 * the handler produced (inside the inner `next()`, before the structural phase
 * runs) and restore it afterwards. Per-route stricter CSP wins; responses that
 * do not set their own CSP keep the structural default, and SSR pages keep
 * their inline `<script>`/`<style>` working (structural CSP omits `default-src`
 * / `script-src` / `style-src`).
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  // eslint-disable-next-line functional/no-let
  let routeCsp: string | undefined
  // eslint-disable-next-line functional/no-expression-statements
  await structuralSecureHeaders(c, async () => {
    // eslint-disable-next-line functional/no-expression-statements
    await next()
    // eslint-disable-next-line functional/no-expression-statements
    routeCsp = c.res.headers.get('Content-Security-Policy') ?? undefined
  })
  if (routeCsp !== undefined) {
    c.res.headers.set('Content-Security-Policy', routeCsp)
  }
}
