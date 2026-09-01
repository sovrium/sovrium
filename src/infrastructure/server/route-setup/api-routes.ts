/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { timeout } from 'hono/timeout'
import {
  healthResponseSchema,
  buildAiHealthStatusWithEcoRouting,
  type HealthResponse,
} from '@/domain/models/api/health/health'
import { linkTargets } from '@/domain/models/app/links'
import { resolveOllamaBaseUrl } from '@/domain/models/env/ai/ai-eco-routing'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { resetAuditEntries } from '@/infrastructure/audit-log/in-memory-store'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { createAvatarProfileStore } from '@/infrastructure/auth/better-auth/avatar-profile-store'
import { resetFormRateLimitState } from '@/infrastructure/forms/form-rate-limiter'
import { FormRenderers } from '@/infrastructure/layers/form-renderer-layer'
import { ecoIndexHeaderMiddleware } from '@/infrastructure/server/middleware/eco-index-header'
import { lowDataModeMiddleware } from '@/infrastructure/server/middleware/low-data-mode'
import { chainLowDataOptOutRoute } from '@/infrastructure/server/middleware/low-data-opt-out'
import { resetEcoIndexTrackerAtBoot } from '@/infrastructure/utils/eco-index-tracker'
import { resetPageCacheStatsAtBoot } from '@/infrastructure/utils/page-cache-telemetry'
import { resetTelemetryEpochAtBoot } from '@/infrastructure/utils/telemetry-epoch'
import {
  authMiddleware,
  requireAuth,
  requireAuthOrGuestComment,
  requireAdmin,
} from '@/presentation/api/middleware/auth'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import {
  chainTableRoutes,
  chainAccountRoutes,
  chainAuthRoutes,
  chainActiveScopeRoutes,
  chainActivityRoutes,
  chainAdminRoutes,
  chainAgentApprovalRoutes,
  chainAgentScheduleRoutes,
  chainAiChatRoutes,
  chainAiMcpStatusRoutes,
  chainRagRoutes,
  chainAiFactsRoutes,
  chainAnalyticsRoutes,
  chainAutomationRoutes,
  chainBucketRoutes,
  chainFormRoutes,
  chainSharedViewRoute,
} from '@/presentation/api/routes'
import { chainAdminAgentsRoutes } from '@/presentation/api/routes/admin/agents'
import { chainAdminAuditLogRoutes } from '@/presentation/api/routes/admin/audit-log'
import { chainAdminAutomationsRoutes } from '@/presentation/api/routes/admin/automations'
import { chainAdminBucketsRoutes } from '@/presentation/api/routes/admin/buckets'
import { chainAdminConfigIntrospectionRoutes } from '@/presentation/api/routes/admin/config-introspection'
import { chainAdminConnectionsRoutes } from '@/presentation/api/routes/admin/connections'
import { chainAdminConnectionActionRoutes } from '@/presentation/api/routes/admin/connections-actions'
import { chainAdminDesignSystemRoutes } from '@/presentation/api/routes/admin/design-system'
import { chainAdminDesignSystemShareRoutes } from '@/presentation/api/routes/admin/design-system-shares'
import { chainAdminFootprintRoutes } from '@/presentation/api/routes/admin/footprint'
import { chainAdminFormsRoutes } from '@/presentation/api/routes/admin/forms'
import { chainAdminFormsAnalyticsExportRoutes } from '@/presentation/api/routes/admin/forms-analytics-export'
import { chainAdminLinksRoutes } from '@/presentation/api/routes/admin/links'
import { chainAdminUsersRoutes } from '@/presentation/api/routes/admin/users-overview'
import { chainCommandSearchRoutes } from '@/presentation/api/routes/command-search'
import { commandSearchRateLimitMiddleware } from '@/presentation/api/routes/command-search/command-search-rate-limit'
import { chainConnectionRoutes } from '@/presentation/api/routes/connections'
import { chainFavoriteRoutes } from '@/presentation/api/routes/favorites'
import { chainRealtimeRoutes } from '@/presentation/api/routes/realtime'
import { chainRecentRoutes } from '@/presentation/api/routes/recent'
import { chainUserDirectoryRoutes } from '@/presentation/api/routes/user-directory'
import { sharedViewsRateLimitMiddleware } from '@/presentation/api/routes/user-views/shared-views-rate-limit'
import { chainAdminRouteGuards, chainAdminRouteGuardsWithoutAuth } from './admin-route-guards'
import {
  isTablesRateLimitExceeded,
  recordTablesRateLimitRequest,
  getTablesRateLimitRetryAfter,
  isActivityRateLimitExceeded,
  recordActivityRateLimitRequest,
  getActivityRateLimitRetryAfter,
} from './auth-route-utils'
import { getLiveApp } from './live-app-store'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Error when health response validation fails
 */
class HealthResponseValidationError extends Data.TaggedError('HealthResponseValidationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Whether a `/api/tables/*` path is the realtime subscription endpoint.
 *
 * `GET /api/tables/:tableId/subscribe` (and the `/subscribe/sse` alias) is a
 * long-lived Server-Sent-Events / WebSocket subscription, NOT a CRUD record
 * read. It must be exempt from the records rate limiter: the browser
 * `EventSource` reconnects every time the bounded-lifetime stream closes, and
 * counting each reconnect against the 100-req/60s `GET:/api/tables/*` budget
 * starves the page's own record reads — and, once the budget is exhausted, a
 * 429 to `EventSource` triggers an immediate reconnect, producing a
 * rate-limit feedback storm. A subscription endpoint is self-limiting (one
 * long connection), so skipping the burst limiter is correct.
 */
const isRealtimeSubscriptionPath = (path: string): boolean =>
  /^\/api\/tables\/[^/]+\/subscribe(\/sse)?$/.test(path)

/**
 * Apply rate limiting middleware for table API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyTablesRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/tables', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const path = '/api/tables'

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
    .use('/api/tables/*', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const { path } = c.req

      // The realtime subscription endpoint is a long-lived stream, not a CRUD
      // read — exempt it from the records burst limiter (see helper doc).
      if (isRealtimeSubscriptionPath(path)) {
        // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
        await next()
        return
      }

      if (isTablesRateLimitExceeded(method, path, ip)) {
        const retryAfter = getTablesRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordTablesRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
}

/**
 * Apply rate limiting middleware for activity API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyActivityRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/activity', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const path = '/api/activity'

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
    .use('/api/activity/*', async (c, next) => {
      const ip = getRequestClientIp(c)
      const { method } = c.req
      const { path } = c.req

      if (isActivityRateLimitExceeded(method, path, ip)) {
        const retryAfter = getActivityRateLimitRetryAfter(method, path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordActivityRateLimitRequest(method, path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
}

/**
 * Resolve a positive-integer env override, falling back to a default.
 */
const envInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Streaming route prefixes that MUST NOT be subject to the request timeout.
 *
 * `/api/ai/chat/stream` is a long-lived Server-Sent-Events response; a
 * `hono/timeout` middleware would abort the stream mid-flight. Any future
 * streaming endpoint must be added here.
 */
const STREAMING_PREFIXES = ['/api/ai/chat/stream', '/api/realtime/presence'] as const

/**
 * Apply a global request timeout to `/api/*` and a body-size guard to the
 * record-mutation route group.
 *
 * - **Timeout** (`hono/timeout`): default 30 s, override via `API_TIMEOUT_MS`.
 *   Skipped for streaming routes (see `STREAMING_PREFIXES`).
 * - **Body limit** (`hono/body-limit`): default 25 MB, override via
 *   `API_BODY_LIMIT_BYTES`. Mounted on the record-mutation route group
 *   (`/api/tables/*`) only — these carry JSON record payloads.
 *
 *   File-upload route groups (`/api/buckets/*`, `/api/forms/*`) are
 *   **deliberately excluded**: the buckets subsystem enforces its own
 *   streaming-aware size limit (per-bucket `maxFileSize` → `STORAGE_MAX_FILE_SIZE`
 *   env → 100 MB default, returning HTTP 413), and the streaming upload server
 *   is designed to accept large files (>50 MB). A blanket Hono `body-limit`
 *   there would override that contract and reject legitimate large uploads.
 *
 * Mounted before auth/rate-limiting so oversized or slow requests are
 * rejected as early as possible.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyRequestGuards = (honoApp: Hono): Hono => {
  const timeoutMs = envInt('API_TIMEOUT_MS', 30_000)
  const bodyLimitBytes = envInt('API_BODY_LIMIT_BYTES', 25 * 1024 * 1024)

  // A FACTORY, not `timeout(timeoutMs)`'s default exception. That default is a
  // module-level singleton `hono/timeout` constructs once at import time, which
  // broke error reporting twice over: its `.stack` is frozen to the CLI's boot
  // import graph (so a timeout report named `cli/index.ts`, a frame with nothing
  // to do with the failed request — in the compiled binary it resolved to the
  // HELP_TEXT line), and its object identity is shared by every timeout for the
  // process lifetime (so the reporter's identity guard muted all but the first).
  // Building a fresh exception per timeout gives each one a request-scoped stack
  // and a distinct identity.
  const timeoutMiddleware = timeout(
    timeoutMs,
    () => new HTTPException(504, { message: 'Gateway Timeout' })
  )

  return honoApp
    .use('/api/*', async (c, next) => {
      // Skip the timeout for long-lived SSE / streaming responses.
      if (STREAMING_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
        return next()
      }
      return timeoutMiddleware(c, next)
    })
    .use('/api/tables/*', bodyLimit({ maxSize: bodyLimitBytes }))
}

/**
 * Create API routes using method chaining pattern
 *
 * Located in Infrastructure layer because this is route composition/wiring
 * (infrastructure concern), not route handler logic (presentation concern).
 *
 * **Why Chaining?**
 * Hono RPC requires method chaining (not .route() mounting) for proper type inference.
 * This allows the RPC client to extract route types automatically.
 *
 * **Pattern**:
 * ```typescript
 * const app = new Hono()
 *   .get('/api/health', handler)
 *   .get('/api/users/:id', handler)
 *   .post('/api/users', handler)
 * ```
 *
 * **Why Not .route()?**
 * ```typescript
 * // ❌ This breaks RPC type inference
 * app.route('/api', subApp)
 * ```
 *
 * See: https://hono.dev/docs/guides/best-practices#building-a-larger-application
 *
 * @param app - Validated application configuration from AppSchema
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with all API routes chained
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
export const createApiRoutes = <T extends Hono>(app: App, honoApp: T) => {
  // Reset the in-process audit-log store on every server boot. E2E tests
  // restart the server between specs but share the Bun process, so the
  // module singleton would otherwise leak entries across tests (see
  // memory: project_test_session_bleed for the analogous DB pattern).
  // The reset is no-op in production where the server boots once.

  resetAuditEntries()

  // The DB-backed `audit_log` table is DELIBERATELY NOT reset here. A boot
  // truncate once lived on this line, for the E2E harness's benefit, and it ran
  // unconditionally: no env gate, no test-only guard, production took exactly
  // the same line. Every restart — a deploy, a crash-loop, a `systemctl
  // restart` — erased the entire audit history, so anyone who could cause a
  // restart could erase their own trail. That is a compliance defect, not a
  // nicety: an audit log a restart can wipe cannot answer the one question it
  // exists to answer.
  //
  // The harness need it served no longer exists either. `[internal ref]`
  // duplicates a fresh template database per TEST
  // (`generateTestDatabaseName` → `_testDatabaseName`, and the analogous
  // per-test file in SQLite mode), so audit rows cannot bleed between specs;
  // isolation comes from the database, not from a truncate the product ships.
  // (`resetAuditEntries()` above is a retained no-op hook, not a second
  // truncate — see its own docstring.)

  // Same boot-reset rationale for the footprint counters — the in-memory grade
  // and page-cache tallies would otherwise leak across E2E spec restarts. The
  // shared epoch is re-stamped FIRST, so both counter sets report an interval
  // that starts at this boot rather than at module load (see
  // infrastructure/utils/telemetry-epoch.ts).
  resetTelemetryEpochAtBoot()
  resetEcoIndexTrackerAtBoot()
  resetPageCacheStatsAtBoot()

  // Same boot-reset rationale for the F-03 / PG-02 in-process rate-limit
  // sliding-window state. Without this, a comment rate-limit test that
  // consumed all 5 slots in spec N would leave spec N+1 starting with the
  // budget already exhausted (the same Bun process re-uses the module-level
  // `Map`).
  resetFormRateLimitState()

  // Eco middleware stack — registered in the order their POST-next code
  // should LAST run. Hono middleware runs LIFO on the response path:
  //   handler → low-data POST (rewrites HTML body) → eco-index POST (grades
  //   the rewritten body via the new Content-Length).
  // So eco-index is registered FIRST (its post-next code runs OUTERMOST,
  // i.e. LAST, AFTER low-data has finished mutating).
  const honoWithEcoMiddleware = honoApp
    .use('*', ecoIndexHeaderMiddleware())
    .use('*', lowDataModeMiddleware())

  // Wire the low-data opt-out endpoint (`/__sovrium/eco/low-data-opt-out`)
  // that the footer "Show full version" link points to. Sets the
  // `sovrium_low_data=off` cookie and 302s back to the source page.
  const honoWithEcoHeader = chainLowDataOptOutRoute(honoWithEcoMiddleware)

  // Create Better Auth instance for middleware
  const auth = createAuthInstance(app.auth)

  // Create health check endpoint
  const honoWithHealth = honoWithEcoHeader.get('/api/health', async (c) => {
    // Use Effect.gen for functional composition
    const program = Effect.gen(function* () {
      // Probe the local Ollama endpoint (if any) so the eco resolver can
      // surface `resolvedProvider` / `ollamaReachable` per ECO_AI_PROVIDER_PRECEDENCE.
      const ollamaReachable = yield* Effect.promise(() =>
        probeOllamaReachable(resolveOllamaBaseUrl(process.env))
      )
      // Build health response (explicitly typed for Zod validation)
      // eslint-disable-next-line functional/prefer-immutable-types -- Required for Zod schema validation
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        app: {
          // Read the live App name so a schema `POST /draft/publish` swap is
          // reflected here without a server restart; fall back to the boot
          // App when the live store has not been seeded.
          name: getLiveApp()?.name ?? app.name,
        },
        ai: buildAiHealthStatusWithEcoRouting(process.env, ollamaReachable, app.agents ?? []),
      }

      // Validate response against schema (ensures type safety)
      const validated = yield* Effect.try({
        try: () => healthResponseSchema.parse(response),
        catch: (error) =>
          new HealthResponseValidationError({
            message: `Health response validation failed: ${error}`,
            cause: error,
          }),
      })

      return validated
    })

    try {
      // Run Effect program and return result
      const data = await Effect.runPromise(program)
      return c.json(data, 200)
    } catch {
      // Handle errors gracefully
      return c.json(
        {
          error: 'Internal server error',
          code: 'HEALTH_CHECK_FAILED',
        },
        500
      )
    }
  })

  // Apply request timeout + body-size guards before rate limiting / auth so
  // oversized or slow requests are rejected as early as possible.
  // (Streaming routes are exempted from the timeout — see applyRequestGuards.)
  const honoWithGuards = applyRequestGuards(honoWithHealth)

  // Apply rate limiting middleware BEFORE auth middleware
  // This prevents auth bypass by rate limiting all requests first
  // Middleware order: rate limiting → authMiddleware (extracts session) → requireAuth (enforces auth)
  const honoWithTablesRateLimit = applyTablesRateLimitMiddleware(honoWithGuards)
  const honoWithActivityRateLimit = applyActivityRateLimitMiddleware(honoWithTablesRateLimit)

  // Apply auth middleware to protected routes
  // This extracts session from Better Auth and attaches to context
  // Activity endpoints ALWAYS require authentication (even when app.auth is not configured)
  // Table endpoints only require authentication if auth is configured
  // Analytics query endpoints require admin role; collect endpoint is public
  //
  // PG-02 guest-comment exemption: `/api/tables/*` uses `requireAuthOrGuestComment`
  // which permits unauthenticated `POST /api/tables/:tableId/records/:recordId/comments`
  // when the resolved table has `comments.guestComments: true`. Every other
  // `/api/tables/*` path still gets the normal 401-on-no-session contract.
  // The bare `/api/tables` list endpoint stays under `requireAuth()` — it
  // returns the table catalog which is never public.
  const resolveAppForGuestCommentExemption = (): App => (getLiveApp() as App | undefined) ?? app
  // F6 dashboard-tier model: thread the live App into the admin-route tier
  // guards so a custom top role (e.g. partner's `engineer`) resolves to
  // `admin-editor` implicitly. Reads the published live App when present
  //, falling back to the boot `app`.
  const resolveAppForTier = (): App => (getLiveApp() as App | undefined) ?? app
  // A form with a custom `path` answers on a second, arbitrary URL that no
  // wildcard below covers (`/forms/*` and `/api/forms/*` miss e.g.
  // `/partner-order`). Without the session attached there, every caller
  // looks anonymous to that route's access gate — so the gate would deny
  // exactly the users it exists to admit, and `$user.*` prefills would
  // render empty.
  //
  // Each path is mounted individually rather than via `.use('/*')`, which
  // would run Better Auth's session lookup on every static asset. That is
  // safe to do because `FormPathSchema` forbids `*` and `:`, so every
  // declared path is a literal, exact-match route.
  const honoWithFormPathAuth = app.auth
    ? (app.forms ?? []).reduce<typeof honoWithActivityRateLimit>(
        (acc, form) =>
          typeof form.path === 'string'
            ? (acc.use(form.path, authMiddleware(auth)) as typeof honoWithActivityRateLimit)
            : acc,
        honoWithActivityRateLimit
      )
    : honoWithActivityRateLimit
  const honoWithPreAdminGuards = app.auth
    ? honoWithFormPathAuth
        .use('/api/tables', authMiddleware(auth))
        .use('/api/tables', requireAuth())
        .use('/api/tables/*', authMiddleware(auth))
        .use('/api/tables/*', requireAuthOrGuestComment(resolveAppForGuestCommentExemption))
        // Cycle 6 ([internal ref]..026): shared-view lookup-by-id.
        // Mounted at a sibling path to `/api/tables/*` because the lookup is
        // cross-table-by-design — any authenticated user can fetch a saved
        // view IFF the table the view binds to grants them read permission.
        // The handler enforces that gate; the middleware here just ensures
        // we have a session to evaluate against.
        .use('/api/shared-views/*', authMiddleware(auth))
        .use('/api/shared-views/*', requireAuth())
        .use('/api/shared-views/*', sharedViewsRateLimitMiddleware)
        .use('/api/activity', authMiddleware(auth))
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', authMiddleware(auth))
        .use('/api/activity/*', requireAuth())
    : honoWithActivityRateLimit
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', requireAuth())

  // Every `/api/admin/*` guard lives in `admin-route-guards.ts` — BOTH mirrors
  // (auth-enabled and no-auth) side by side in one purpose-named file, so an
  // admin route can never be added to one and silently missed in the other.
  // That omission has shipped a hole before; see the module doc there.
  //
  // Applied at exactly this point in the chain, between the activity guards and
  // the analytics guards, so the registration order of every guard is unchanged
  // from when these two blocks were inlined here.
  const honoWithAdminGuards = app.auth
    ? chainAdminRouteGuards(honoWithPreAdminGuards, auth, resolveAppForTier)
    : chainAdminRouteGuardsWithoutAuth(honoWithPreAdminGuards, resolveAppForTier)

  const honoWithAuth = app.auth
    ? honoWithAdminGuards
        .use('/api/analytics/overview', authMiddleware(auth))
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin(resolveAppForTier))
        .use('/api/analytics/pages', authMiddleware(auth))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin(resolveAppForTier))
        .use('/api/analytics/referrers', authMiddleware(auth))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin(resolveAppForTier))
        .use('/api/analytics/devices', authMiddleware(auth))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin(resolveAppForTier))
        .use('/api/analytics/campaigns', authMiddleware(auth))
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin(resolveAppForTier))
        .use('/api/analytics/events', authMiddleware(auth))
        // `/api/analytics/targets` takes the session but NOT `requireAuth` /
        // `requireAdmin`, exactly like `/events` above: its handler answers 404
        // for a missing session and for a non-admin, which is the S1
        // anti-enumeration contract. A `requireAuth` here would short-circuit
        // with 401 first and confirm the endpoint exists to a prober.
        .use('/api/analytics/targets', authMiddleware(auth))
        // Automations: extract session so manual triggers can resolve
        // the caller's role against trigger.requiredRole. Webhook triggers
        // remain anonymous-friendly — handlers gate per-trigger inside the
        // application layer rather than rejecting at the middleware.
        .use('/api/automations/*', authMiddleware(auth))
        // The bare `/api/automations` listing endpoint is NOT covered by
        // the `/*` wildcard above (Hono requires at least one segment to
        // match `/*`). Require authentication so the listing cannot be used
        // as an anonymous enumeration oracle for configured webhook
        // automations — secrets are already redacted by `handleListAutomations`,
        // but the trigger names + request/query schemas are still attacker-
        // useful when discovered by an unauthenticated probe.
        .use('/api/automations', authMiddleware(auth))
        .use('/api/automations', requireAuth())
        // Buckets: extract session so the handler can decide per-bucket whether
        // auth is required (public: false → 401 if no session, public: true →
        // serve the file directly). Do NOT chain requireAuth() — that would
        // reject public-bucket requests before they reach the handler.
        .use('/api/buckets/*', authMiddleware(auth))
        // Connections (OAuth2 / API key / etc.): extract session so handlers
        // can authorize per (connection.scope, role). The OAuth2 callback is
        // accessed by an authenticated browser session (the user who started
        // the authorize flow), so authMiddleware is required here. We do
        // NOT chain requireAuth() — handlers return 401 directly so the
        // 'connection not found' (404) and 'unauthorized' (401) responses
        // can be distinguished cleanly per spec.
        .use('/api/connections/*', authMiddleware(auth))
        // Forms: extract the session so the
        // form-route handlers can enforce the form's own `access.require`
        // gate (401 for `authenticated`, 404 for role denials) and capture
        // the submitter id on the ledger. Both the canonical render route
        // (`/forms/:name`) and the submission endpoint
        // (`/api/forms/:name/submissions`) need the session. We do NOT chain
        // requireAuth() — public forms must stay anonymous-friendly; the
        // per-form gate decides.
        .use('/forms/*', authMiddleware(auth))
        .use('/api/forms/*', authMiddleware(auth))
        // Active-scope session API (P-6): cookie-backed per-tableSlug
        // active assignment. Every handler re-validates the session, but
        // we still apply authMiddleware here so the existing session-
        // attached context helpers (`getSessionContext`) work uniformly.
        // Do NOT chain requireAuth() — the handlers return 401 directly so
        // 401 ('not signed in') and 404 ('scopeTables disabled') can be
        // distinguished cleanly.
        .use('/api/session/active-scope/:tableSlug', authMiddleware(auth))
        // Generic AI chat endpoint (cross-cutting). Always authenticated
        // when `app.auth` is configured — the
        // unauthenticated request must short-circuit to HTTP 401 before
        // the handler runs. The route itself is registered below by
        // `chainAiChatRoutes`.
        .use('/api/ai/chat', authMiddleware(auth))
        .use('/api/ai/chat', requireAuth())
        // Streaming variant — same auth contract (POST /api/ai/chat/stream).
        // Registered as a sibling route by `chainAiChatRoutes`; per
        // [internal ref] must accept JSON body + return 200 + SSE.
        .use('/api/ai/chat/stream', authMiddleware(auth))
        .use('/api/ai/chat/stream', requireAuth())
        // Conversation-history routes (durable AI chat memory,
        // [internal ref]) — list/get/delete a user's
        // conversation threads. Per-user scoping needs
        // the authenticated session, so both the bare path and the
        // `:sessionId` sub-paths get the auth chain.
        .use('/api/ai/conversations', authMiddleware(auth))
        .use('/api/ai/conversations', requireAuth())
        .use('/api/ai/conversations/*', authMiddleware(auth))
        .use('/api/ai/conversations/*', requireAuth())
        // Agent action + approval routes. authMiddleware extracts the session
        // so approval-decision handlers can RBAC-gate by role level. We do NOT
        // chain requireAuth() — the execute path runs without a session, and
        // the decision handlers return 401/403 directly so the spec can
        // distinguish unauthenticated from insufficient-role.
        .use('/api/agents/*', authMiddleware(auth))
        // Account self-service + GDPR routes (D3/D4/D5). authMiddleware
        // attaches the session so the export/delete handlers can read the
        // caller id and return 401 themselves. requireAuth is NOT chained:
        // `/api/account/purge-due` is an internal scheduler trigger and
        // runs without a session.
        .use('/api/account/*', authMiddleware(auth))
        // Favorites routes.
        // authMiddleware attaches the session so the per-user list/add/remove
        // handlers can scope every query to the caller's `userId`. The
        // handlers return 401 themselves when no session is attached, so
        // requireAuth is not chained.
        .use('/api/favorites', authMiddleware(auth))
        // User directory — the candidate source a `user` field's picker reads.
        // authMiddleware attaches the session; the handler returns 401 itself
        // when there is none, so requireAuth is not chained. Deliberately NOT
        // admin-tier: see the route module for why it is readable by every
        // signed-in account, and why its body carries no email.
        .use('/api/users/*', authMiddleware(auth))
        // Recent items + command-palette search
        //. authMiddleware
        // attaches the session so the per-user recent list and the
        // favorited-boost ranking can resolve the caller. Handlers tolerate a
        // missing session, so requireAuth is not chained.
        .use('/api/recent', authMiddleware(auth))
        .use('/api/command-search', authMiddleware(auth))
        // Realtime presence (Wave-6). authMiddleware attaches the session so
        // the presence SSE handler can resolve the caller's id + display
        // name. requireAuth is NOT chained — the handler returns 401 itself
        // so the SSE response shape stays under the handler's control.
        .use('/api/realtime/presence', authMiddleware(auth))
    : honoWithAdminGuards
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin(resolveAppForTier))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin(resolveAppForTier))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin(resolveAppForTier))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin(resolveAppForTier))
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin(resolveAppForTier))

  // Chain table routes (always register, returns empty array if no tables configured)
  // Routes now have access to session via c.var.session
  // Pass app configuration for table metadata lookup (tableId → table name mapping).
  //
  // [internal ref]: supply a live-App resolver so a table added by a schema
  // `POST /draft/publish` (which swaps the live App + applies additive DDL
  // without a restart) is immediately resolvable by `validateTable` and
  // queryable by the record handlers. `getLiveApp()` returns the published
  // snapshot once a publish has happened; before any publish it is undefined
  // and the resolver falls back to the boot `app`.
  const resolveLiveApp = (): App => (getLiveApp() as App | undefined) ?? app
  const honoWithTables = chainTableRoutes(honoWithAuth, app, resolveLiveApp)

  // Cycle 6 ([internal ref]..026): mount the share-by-id lookup at
  // `/api/shared-views/:viewId`. Sits outside the `/api/tables/*` chain
  // because the share contract is cross-table — the requesting session may
  // hold no permissions on the view's bound table, in which case the handler
  // 404s for anti-enumeration.
  const honoWithSharedViews = chainSharedViewRoute(honoWithTables, resolveLiveApp)

  // Chain activity routes (activity log access)
  const honoWithActivity = chainActivityRoutes(honoWithSharedViews)

  // Chain analytics routes only when analytics is enabled (not undefined, not false)
  // When analytics is not configured, all /api/analytics/* endpoints return 404 (no routes registered)
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  const honoWithAnalytics = analyticsEnabled
    ? chainAnalyticsRoutes(honoWithActivity, {
        appName: app.name,
        retentionDays: typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined,
        excludedPaths: typeof app.analytics === 'object' ? app.analytics.excludedPaths : undefined,
        respectDoNotTrack:
          typeof app.analytics === 'object' ? app.analytics.respectDoNotTrack : undefined,
        // Lets `/api/analytics/targets` name the destination each recorded
        // `targetIndex` resolves to TODAY. Read through `resolveLiveApp` (not
        // the boot `app`) so a reload that re-points a link is reflected without
        // a restart; an index the current list no longer covers reports null
        // rather than being dropped from the split.
        resolveLinks: () =>
          (resolveLiveApp().links ?? []).map((link) => ({
            slug: link.slug,
            destinations: linkTargets(link).map((target) => target.to),
          })),
      })
    : honoWithActivity

  // Chain automation routes (webhook triggers + run history listing)
  // Always registered: when no automations are configured, /api/automations/*
  // returns 404 by virtue of automation lookup failing inside the handler.
  const honoWithAutomations = chainAutomationRoutes(honoWithAnalytics, app)

  // Chain OAuth2 connection routes (authorize, callback, status, disconnect).
  // Reads `app.connections[]` for provider configuration; per-user tokens
  // persist to system.connection_tokens encrypted at rest.
  const honoWithConnections = chainConnectionRoutes(honoWithAutomations, app)

  // (share-link routes removed Task #18 — feature cut per user Decision #3)

  // Chain bucket routes (file access with per-bucket public/private enforcement)
  const honoWithBuckets = chainBucketRoutes(honoWithConnections, app)

  // Chain standalone-form routes (canonical GET /forms/:name + custom-path
  // aliases + POST /api/forms/:name/submissions). Always registered;
  // handlers return 404 when the requested form is not declared in
  // `app.forms[]` so apps without forms behave identically. Renderers
  // are injected here (composition root) because the route file lives
  // in the presentation layer and cannot import the React renderer
  // from `presentation/rendering/forms` directly under the layer rules.
  const honoWithForms = chainFormRoutes(honoWithBuckets, app, FormRenderers)

  // Chain admin routes (storage status and other administrative inspectors).
  // Auth gating (admin-only) is applied above via authMiddleware → requireAuth
  // → requireAdmin on the matching route paths.
  const honoWithAdmin = chainAdminRoutes(honoWithForms, app)

  // Chain admin/buckets + admin/audit-log routes ([internal ref],
  // [internal ref]). Auth gating (admin + operator tier) is
  // applied above via authMiddleware → requireAuth → requireAdminTier on
  // /api/admin/buckets, /api/admin/buckets/overview, and /api/admin/audit-log.
  // `app` is threaded in so both endpoints enumerate the buckets the config
  // declares (`app.buckets[]`) rather than the single env-resolved backend.
  const honoWithAdminBuckets = chainAdminBucketsRoutes(honoWithAdmin, app)
  // Chain admin/forms routes — list/detail of `app.forms[]` + the form-
  // submissions sub-resource (list, detail, bulk). The route handler
  // resolves the live App via `resolveLiveApp` so a `POST /draft/publish`
  // is reflected without restart.
  //
  // F-04: the analytics+export routes register BEFORE the existing
  // `:submissionId` dynamic segment so `/submissions/export` resolves
  // to the export handler rather than being captured as a submission id.
  const honoWithAdminFormsAnalytics = chainAdminFormsAnalyticsExportRoutes(
    honoWithAdminBuckets,
    resolveLiveApp
  )
  const honoWithAdminForms = chainAdminFormsRoutes(honoWithAdminFormsAnalytics, resolveLiveApp)
  const honoWithAdminAuditLog = chainAdminAuditLogRoutes(honoWithAdminForms)

  // Chain the READ-ONLY projections of the running configuration — one family,
  // chained together because they are gated identically and answer the same
  // question at two levels of detail:
  // [internal ref] A1: the App-schema reflection (`/api/admin/config/schema`) and
  //               the declared-env viewer (`/api/admin/env`).
  // [internal ref] A2: the design-system exports (`/api/admin/design-system.json`
  //               and `.md`), both projecting `buildDesignSystem(app)` so the
  //               two formats cannot describe different systems.
  // Auth gating is applied above via authMiddleware → requireAdminTier on each
  // of the four paths. `resolveLiveApp` (not the boot `app`) throughout, so a
  // reload is reflected without a restart — an export describing the previous
  // deploy's palette is worse than no export, and that promise is the point.
  // [internal ref] A3: the design-system SHARE endpoints (mint / list / revoke).
  //               Their anonymous counterpart, `GET /s/design-system/{token}`,
  //               is a platform route registered in `server.ts` — these three
  //               are admin-guarded like every other A1/A2 surface, and their
  //               guard is EXPLICIT: `admin-route-guards.ts` lists the
  //               `/api/admin/design-system.*` exports as exact paths with no
  //               wildcard, so `/design-system/shares` inherits nothing.
  const honoWithAdminConfigReads = chainAdminDesignSystemShareRoutes(
    chainAdminDesignSystemRoutes(
      chainAdminConfigIntrospectionRoutes(honoWithAdminAuditLog, resolveLiveApp),
      resolveLiveApp
    ),
    resolveLiveApp
  )

  // Chain admin/footprint routes. Auth
  // gating (admin + operator tier) is applied above via
  // authMiddleware → requireAdminTier on /api/admin/footprint/overview.
  const honoWithAdminFootprint = chainAdminFootprintRoutes(honoWithAdminConfigReads, app)

  // Chain admin/automations routes (overview + runs list/detail). Auth gating
  // is applied above via authMiddleware → requireAdminTier on
  // /api/admin/automations + /api/admin/automations/*. The handlers resolve
  // the live App via `resolveLiveApp` so a `POST /draft/publish` is reflected
  // in the overview's `totals.automations` count without restart.
  const honoWithAdminAutomations = chainAdminAutomationsRoutes(
    honoWithAdminFootprint,
    resolveLiveApp
  )

  // Chain admin/users routes (overview tile). Auth gating is applied above
  // via authMiddleware → requireAdminTier on /api/admin/users/overview.
  // The handler reads exclusively from auth.user + auth.session — no live-App
  // dependency, so the resolver thunk is not threaded through.
  const honoWithAdminUsers = chainAdminUsersRoutes(honoWithAdminAutomations)

  // Chain admin agent-conversation read endpoints:
  // GET /api/admin/agents and /api/admin/agents/:name/conversations[/:id]. Shares
  // the `/api/admin/agents/*` wildcard (authMiddleware → requireAdminTier) with the
  // per-agent metrics endpoint below; the segment-less index is gated by the
  // trailing `/api/admin/*` catch-all. Resolves the live App via `resolveLiveApp`
  // for the `isConversationSourceAgent` anti-enum gate (reflects a
  // `POST /draft/publish`, [internal ref]).
  const honoWithAdminAgents = chainAdminAgentsRoutes(honoWithAdminUsers, resolveLiveApp)

  // Chain admin connection read endpoints:
  // GET /api/admin/connections[/:id]. Reads the RUNTIME DB rows in
  // `system.connections` + the per-connection token summary from
  // `system.connection_tokens` (NOT `app.connections` config), so no live-App
  // resolver is threaded. Auth gating is applied above via authMiddleware →
  // requireAdminTier on BOTH the `/api/admin/connections/*` wildcard and the
  // bare `/api/admin/connections` path. The single-segment `/:id` detail route
  // is the connections directory's only per-resource sub-path.
  const honoWithAdminConnections = chainAdminConnectionsRoutes(honoWithAdminAgents)

  // Chain admin connection ACTION endpoints: POST /api/admin/connections/:id/authorize, GET.../:name/callback,
  // POST .../:id/disconnect. The boot `app` is threaded in for the by-name
  // OAuth-props resolution (clientId/clientSecret/urls live in `app.connections`
  // config, not the runtime DB row). Auth gating is applied above via
  // authMiddleware → requireAdminTier on the `/api/admin/connections/*` wildcard
  // (admits the admin tier incl. a custom top role; 404s member/anon). The
  // two-segment action paths are distinct from the single-segment `/:id` detail
  // route registered above, so they never shadow it.
  const honoWithAdminConnectionActions = chainAdminConnectionActionRoutes(
    honoWithAdminConnections,
    app
  )

  // Chain the short-link console ([internal ref] / -MUTATIONS). The
  // catalog is a UNION of two populations — `app.links[]` entries resolved from
  // the file and `system.links` rows minted at runtime — so `resolveLiveApp`
  // (not the boot `app`) is threaded through: a reload that adds a config link
  // must reserve that slug against mutation on the next request, not the next
  // restart. Auth gating is applied above via authMiddleware → requireAdminTier
  // on BOTH the bare `/api/admin/links` path and the `/api/admin/links/*`
  // wildcard, which the `/:slug/{enable,disable}` state routes need.
  const honoWithAdminLinks = chainAdminLinksRoutes(honoWithAdminConnectionActions, resolveLiveApp)

  // Chain generic AI chat route (POST /api/ai/chat). Always registered;
  // when AI is not configured (`AI_PROVIDER` unset) the handler returns
  // 503 with a JSON error envelope. Auth gating (401 when unauthenticated)
  // is applied above via `authMiddleware + requireAuth` on `/api/ai/chat`.
  const honoWithAiChat = chainAiChatRoutes(honoWithAdminLinks, app)

  // Chain AI MCP cross-cutting status routes (X-1). Always registered: when
  // MCP_SERVER_ENABLED / MCP_ENABLED / MCP_CLIENT_SERVERS env vars are unset
  // the GET handlers return JSON 404 so the API shape stays stable. The
  // server's actual JSON-RPC `/mcp` route is mounted separately by
  // `setupMcpRoutes` and is gated by `MCP_ENABLED` (default-off).
  // Chain AI MCP status routes then AI agent action + human-in-the-loop
  // approval routes (POST /api/agents/:name/execute, approval lifecycle
  // endpoints, agent config readback). Both are always registered; handlers
  // return 404 for agents not declared in `app.agents`, keeping the API shape
  // stable across configs. Combined into one binding to stay within the
  // `max-statements` cap for this composition-root function.
  const honoWithAgents = chainAgentScheduleRoutes(
    chainAgentApprovalRoutes(chainAiMcpStatusRoutes(honoWithAiChat, app), app),
    app
  )

  // Chain RAG routes ([internal ref]-*): config / similarity-search / rebuild /
  // agent-config readback. `rebuild` and `search` enforce their own gates inside
  // `rag-route.ts` (so 401 stays distinguishable from 403/404), and that
  // requires the session to be ATTACHED first — hence `authMiddleware` on all
  // three paths when `app.auth` is configured.
  //
  // `search` joined this list with [internal ref], and had to: without the middleware
  // its own gate reads no session even for a caller holding a perfectly valid
  // cookie, so it would 401 EVERY caller rather than only anonymous ones. The
  // gate and its prerequisite move together.
  //
  // `config` and `status` stay open — pure config readback, no record data.
  const honoWithRag = chainRagRoutes(
    app.auth !== undefined
      ? (honoWithAgents
          .use('/api/ai/rag/rebuild', authMiddleware(auth))
          .use('/api/ai/rag/search', authMiddleware(auth))
          .use('/api/ai/agents/*', authMiddleware(auth)) as typeof honoWithAgents)
      : honoWithAgents,
    app
  )

  // Chain agent facts-memory routes: per-agent
  // learned-facts chat + recall on `/api/ai/agents/:name/chat` and
  // `/api/ai/agents/:name/recall`. Always registered; handlers return 404 for
  // agents not declared in `app.agents`. The `/api/ai/agents/*` auth chain is
  // installed above alongside `chainRagRoutes` when `app.auth` is configured.
  const honoWithAiFacts = chainAiFactsRoutes(honoWithRag, app)

  // Chain active-scope session routes (P-6). Always registered: when
  // `auth.scopeTables` is unset, handlers return 404 — keeping the API
  // shape stable across configurations. Session validation lives inside
  // the handlers so 401 / 403 / 404 can be distinguished cleanly per spec.
  const honoWithActiveScope = chainActiveScopeRoutes(honoWithAiFacts, app)

  // Chain account self-service + GDPR routes (D3/D4/D5): GET
  // /api/account/export, POST /api/account/delete, POST
  // /api/account/purge-due. Always registered; the export/delete handlers
  // return 401 when no session is attached, and `purge-due` runs the
  // hard-delete scheduler. The `/api/account/*` auth chain is installed
  // above when `app.auth` is configured.
  const honoWithAccount = chainAccountRoutes(
    honoWithActiveScope,
    app,
    createAvatarProfileStore(auth)
  )

  // Chain favorites routes:
  // GET/POST/DELETE /api/favorites. Always registered; handlers return 401
  // when no session is attached (the `/api/favorites` auth chain is installed
  // above when `app.auth` is configured).
  const honoWithFavorites = chainFavoriteRoutes(honoWithAccount)

  // Chain the user directory: GET /api/users/directory. Always registered; the
  // handler returns 401 when no session is attached (the `/api/users/*` auth
  // chain is installed above when `app.auth` is configured).
  const honoWithUserDirectory = chainUserDirectoryRoutes(honoWithFavorites)

  // Chain recent-item + command-palette search routes
  //:
  // GET/POST /api/recent and GET /api/command-search. Always registered; the
  // `/api/recent` + `/api/command-search` auth chains are installed above when
  // `app.auth` is configured.
  const honoWithRecent = chainRecentRoutes(honoWithUserDirectory)
  // Palette request ceiling,
  // registered HERE rather than in either arm of the auth ternary above: the
  // route is reachable anonymously, so the limiter has to apply on the no-auth
  // branch too, and this point is downstream of BOTH arms. Mounted before the
  // handler so a rejected request never reaches the per-table fan-out.
  const honoWithCommandSearch = chainCommandSearchRoutes(
    honoWithRecent.use('/api/command-search', commandSearchRateLimitMiddleware),
    app
  )

  // Chain realtime presence routes (Wave-6): GET /api/realtime/presence.
  // Always registered; the handler returns 401 when no session is attached
  // (the `/api/realtime/presence` auth chain is installed above when
  // `app.auth` is configured).
  const honoWithRealtime = chainRealtimeRoutes(honoWithCommandSearch, app)

  // Chain auth routes (role manipulation prevention)
  return chainAuthRoutes(honoWithRealtime, auth)
}

/**
 * Type export for Hono RPC client
 *
 * This type is used by the RPC client to provide full type safety
 * and autocomplete for API calls on the frontend.
 *
 * **Important**: This type must be extracted from the chained result,
 * not from a sub-app mounted with .route()
 *
 * @example
 * ```typescript
 * import { hc } from 'hono/client'
 * import type { ApiType } from '@/infrastructure/server/route-setup/api-routes'
 *
 * const client = hc<ApiType>('http://localhost:3000')
 * const res = await client.api.health.$get()
 * const data = await res.json() // Fully typed HealthResponse!
 * ```
 * @public
 */
export type ApiType = ReturnType<typeof createApiRoutes<Hono>>
