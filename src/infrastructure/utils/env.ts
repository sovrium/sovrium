/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseEcoFormAnalytics } from '@/domain/models/env/eco/eco-form-analytics'
import { isDebugLevel } from '@/domain/models/env/logging/logging'
import { isLocalDevDefault } from '@/domain/utils/dev-mode'
import { isInsecureOptOut, isLoopbackHost } from '@/infrastructure/utils/security-posture'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * Read NODE_ENV at runtime without being statically replaced by Bun.build's
 * `define` option. The build script sets `define['process.env.NODE_ENV']` to
 * force the production JSX transform, but runtime environment detection must
 * remain dynamic so the npm package respects the deployer's NODE_ENV.
 */
const env = process.env as Record<string, string | undefined>

export const getNodeEnv = (): string | undefined => env['NODE_ENV']
export const isProduction = (): boolean => getNodeEnv() === 'production'
export const isDevelopment = (): boolean => getNodeEnv() === 'development'

/**
 * Whether debug-level logging is active for this process.
 *
 * Thin infra accessor over the `env/logging` model — the single source of truth
 * read by the unified observability runtime (`observability-runtime.ts`) to set
 * its `minimumLogLevel`, gating the stdout logger and the OTLP tee together so
 * the two can never drift: debug lines print and export together, or neither.
 */
export const isDebugEnabled = (): boolean => isDebugLevel()

/**
 * Whether in-memory render caches (compiled CSS, page HTML, dev JS bundles)
 * should be bypassed so edits appear immediately without a server restart.
 *
 * True when `NODE_ENV=development`, or when an operator explicitly opts in with
 * `SOVRIUM_DEV_NO_CACHE=1` (e.g. running `sovrium start --watch` with NODE_ENV
 * unset). This is an operator-controlled dev concern — an env var, never app
 * schema. Production (and the default unset-NODE_ENV case) keep caching on; the
 * cache-key fix + clear-on-reload already keep `--watch` correct there.
 */
export const isDevCacheDisabled = (): boolean =>
  env['SOVRIUM_DEV_NO_CACHE'] === '1' || isDevelopment()

/**
 * Whether the static page-output cache (`ECO_PAGE_CACHE`) should be bypassed for
 * a dev edit-loop. Unlike {@link isDevCacheDisabled} this honours ONLY the
 * explicit `SOVRIUM_DEV_NO_CACHE=1` watch-mode opt-in — it does NOT treat
 * `NODE_ENV=development` as a blanket disable.
 *
 * The page cache is governed by the `ECO_PAGE_CACHE` operator toggle (an
 * eco-aligned platform property), so a development NODE_ENV must not silently
 * override an explicit `ECO_PAGE_CACHE=on`. The `--watch` workflow still gets a
 * fresh render per request because it sets `SOVRIUM_DEV_NO_CACHE=1` (the
 * cache-key checksum + clear-on-reload already keep `--watch` correct
 * otherwise).
 */
export const isPageCacheDevBypassed = (): boolean => env['SOVRIUM_DEV_NO_CACHE'] === '1'

/**
 * Whether the dev live-reload affordance (the `/__sovrium_dev/reload` SSE route
 * and the `<script src="/assets/dev-reload.js">` injected into page HTML) should
 * be active for this server.
 *
 * The live-reload script is a *local development* convenience — it auto-reloads
 * the browser after a `sovrium start --watch` restart. It must be present when a
 * developer runs the CLI locally (NODE_ENV unset) and ABSENT in production
 * (NODE_ENV=production).
 *
 * Crucially it must ALSO be absent when `NODE_ENV=development` is set
 * explicitly: the E2E in-process test server sets `NODE_ENV=development` purely
 * to skip the production CSS check, NOT to
 * request a live-reload session. An empty page served by such a test server must
 * emit zero `<script src>` tags. The genuine local-dev
 * default — and the CLI dev-experience specs — leave NODE_ENV unset, so gating
 * on "NODE_ENV is unset/empty" cleanly separates the two non-production modes.
 */
export const isLiveReloadEligible = (): boolean => isLocalDevDefault(getNodeEnv())

/**
 * Whether form-submission analytics events should be written to
 * `system.analytics_events`. Per the locked F-04 scope, defaults to ON
 * (frugal-by-default — eco posture is opt-OUT). Operators can opt-out
 * with `ECO_FORM_ANALYTICS=off` for an ultra-frugal posture. Per-form
 * `analytics.enabled: false` is a separate, finer-grained gate
 * evaluated alongside this env-var.
 *
 * Delegates to the domain parser so the lever has exactly ONE reader. It was
 * previously decided inline here, which put it out of reach of every consumer
 * that resolves eco levers from the domain — including the footprint
 * dashboard's `levers` panel, which must report all eight levers or none.
 */
export const isFormAnalyticsEnabled = (): boolean => parseEcoFormAnalytics(env) === 'on'

/**
 * Collect the optional insecure-posture security warning as a structured
 * startup phase ("silent on a safe posture, loud when explicitly relaxed on a
 * public bind").
 *
 * Security-sensitive defaults — CSRF enforcement and secure cookies (see
 * `src/infrastructure/auth/better-auth/auth.ts`) — are now gated on TRANSPORT
 * POSTURE, not `NODE_ENV` (see `security-posture.ts`). They are secure by
 * default on a non-loopback bind, and relaxed on loopback OR when the operator
 * sets the master `SOVRIUM_ALLOW_INSECURE=1` opt-out.
 *
 * The dangerous combination worth flagging loudly is therefore: binding a
 * NON-LOOPBACK interface (a publicly-reachable deployment) WHILE the master
 * insecure opt-out is set — that deliberately disables CSRF + secure cookies on
 * a public surface. We surface that as a `⚠` banner phase so it is impossible
 * to miss.
 *
 * Behaviour:
 *   - Loopback bind (the dev default), with or without the opt-out → SUPPRESSED
 *     (returns `undefined`). Local DX stays clean.
 *   - Non-loopback bind WITHOUT the opt-out → secure by default, nothing to
 *     warn about → `undefined`.
 *   - Non-loopback bind WITH `SOVRIUM_ALLOW_INSECURE=1` → returns a structured
 *     `⚠` warning StartupPhase (never a raw pre-banner `console.warn`).
 *
 * @param bindHost - the effective bind/canonical host (server.ts passes the
 *   resolved hostname). When loopback, the warning is suppressed.
 */
export const collectInsecureEnvWarning = (bindHost?: string): StartupPhase | undefined => {
  // Loopback bind → relaxed posture is expected and intentional → suppress.
  if (isLoopbackHost(bindHost)) {
    return undefined
  }
  // Non-loopback bind with the master insecure opt-out explicitly set is a
  // dangerous public posture (CSRF + secure cookies disabled on a reachable
  // interface). Surface it LOUD.
  if (isInsecureOptOut()) {
    return {
      label:
        'SOVRIUM_ALLOW_INSECURE is set on a non-loopback bind — CSRF protection and secure cookies are DISABLED on a publicly-reachable interface',
      type: 'warning' as const,
    }
  }
  return undefined
}
