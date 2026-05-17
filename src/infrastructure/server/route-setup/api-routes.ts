/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import {
  healthResponseSchema,
  buildAiHealthStatusWithEcoRouting,
  type HealthResponse,
} from '@/domain/models/api/health/health'
import { resolveOllamaBaseUrl } from '@/domain/models/env/ai-eco-routing'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { FormRenderers } from '@/infrastructure/layers/form-renderer-layer'
import { authMiddleware, requireAuth, requireAdmin } from '@/presentation/api/middleware/auth'
import {
  chainTableRoutes,
  chainAuthRoutes,
  chainActiveScopeRoutes,
  chainActivityRoutes,
  chainAdminRoutes,
  chainAiChatRoutes,
  chainAiMcpStatusRoutes,
  chainAnalyticsRoutes,
  chainAutomationRoutes,
  chainBucketRoutes,
  chainFormRoutes,
} from '@/presentation/api/routes'
import { chainConnectionRoutes } from '@/presentation/api/routes/connections'
import { chainNotificationRoutes } from '@/presentation/api/routes/notifications'
import { chainShareLinkRoutes } from '@/presentation/api/routes/share-links'
import {
  extractClientIp,
  isTablesRateLimitExceeded,
  recordTablesRateLimitRequest,
  getTablesRateLimitRetryAfter,
  isActivityRateLimitExceeded,
  recordActivityRateLimitRequest,
  getActivityRateLimitRetryAfter,
} from './auth-route-utils'
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
 * Apply rate limiting middleware for table API endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
const applyTablesRateLimitMiddleware = (honoApp: Hono): Hono => {
  return honoApp
    .use('/api/tables', async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
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
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { method } = c.req
      const { path } = c.req

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
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
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
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
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
// eslint-disable-next-line functional/prefer-immutable-types, max-lines-per-function -- Hono types are mutable by library design; function composes middleware chain and requires activity auth setup
export const createApiRoutes = <T extends Hono>(app: App, honoApp: T) => {
  // Create Better Auth instance for middleware
  const auth = createAuthInstance(app.auth)

  // Create health check endpoint
  const honoWithHealth = honoApp.get('/api/health', async (c) => {
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
          name: app.name,
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

  // Apply rate limiting middleware BEFORE auth middleware
  // This prevents auth bypass by rate limiting all requests first
  // Middleware order: rate limiting → authMiddleware (extracts session) → requireAuth (enforces auth)
  const honoWithTablesRateLimit = applyTablesRateLimitMiddleware(honoWithHealth)
  const honoWithActivityRateLimit = applyActivityRateLimitMiddleware(honoWithTablesRateLimit)

  // Apply auth middleware to protected routes
  // This extracts session from Better Auth and attaches to context
  // Activity endpoints ALWAYS require authentication (even when app.auth is not configured)
  // Table endpoints only require authentication if auth is configured
  // Analytics query endpoints require admin role; collect endpoint is public
  const honoWithAuth = app.auth
    ? honoWithActivityRateLimit
        .use('/api/tables', authMiddleware(auth))
        .use('/api/tables', requireAuth())
        .use('/api/tables/*', authMiddleware(auth))
        .use('/api/tables/*', requireAuth())
        .use('/api/activity', authMiddleware(auth))
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', authMiddleware(auth))
        .use('/api/activity/*', requireAuth())
        .use('/api/admin/storage/status', authMiddleware(auth))
        .use('/api/admin/storage/status', requireAuth())
        .use('/api/admin/storage/status', requireAdmin())
        .use('/api/admin/buckets/quota', authMiddleware(auth))
        .use('/api/admin/buckets/quota', requireAuth())
        .use('/api/admin/buckets/quota', requireAdmin())
        .use('/api/analytics/overview', authMiddleware(auth))
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin())
        .use('/api/analytics/pages', authMiddleware(auth))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin())
        .use('/api/analytics/referrers', authMiddleware(auth))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin())
        .use('/api/analytics/devices', authMiddleware(auth))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin())
        .use('/api/analytics/campaigns', authMiddleware(auth))
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin())
        .use('/api/analytics/events', authMiddleware(auth))
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
        // Active-scope session API (P-6): cookie-backed per-tableSlug
        // active assignment. Every handler re-validates the session, but
        // we still apply authMiddleware here so the existing session-
        // attached context helpers (`getSessionContext`) work uniformly.
        // Do NOT chain requireAuth() — the handlers return 401 directly so
        // 401 ('not signed in') and 404 ('scopeTables disabled') can be
        // distinguished cleanly.
        .use('/api/session/active-scope/:tableSlug', authMiddleware(auth))
        // Generic AI chat endpoint (cross-cutting). Always authenticated
        // when `app.auth` is configured — per APP-AI-CHAT-CROSS-007 the
        // unauthenticated request must short-circuit to HTTP 401 before
        // the handler runs. The route itself is registered below by
        // `chainAiChatRoutes`.
        .use('/api/ai/chat', authMiddleware(auth))
        .use('/api/ai/chat', requireAuth())
        // Streaming variant — same auth contract (POST /api/ai/chat/stream).
        // Registered as a sibling route by `chainAiChatRoutes`; per
        // APP-AI-CHAT-STREAM-001 must accept JSON body + return 200 + SSE.
        .use('/api/ai/chat/stream', authMiddleware(auth))
        .use('/api/ai/chat/stream', requireAuth())
    : honoWithActivityRateLimit
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', requireAuth())
        .use('/api/admin/storage/status', requireAuth())
        .use('/api/admin/storage/status', requireAdmin())
        .use('/api/admin/buckets/quota', requireAuth())
        .use('/api/admin/buckets/quota', requireAdmin())
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin())
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin())
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin())
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin())
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin())

  // Chain table routes (always register, returns empty array if no tables configured)
  // Routes now have access to session via c.var.session
  // Pass app configuration for table metadata lookup (tableId → table name mapping)
  const honoWithTables = chainTableRoutes(honoWithAuth, app)

  // Chain activity routes (activity log access)
  const honoWithActivity = chainActivityRoutes(honoWithTables)

  // Chain analytics routes only when analytics is enabled (not undefined, not false)
  // When analytics is not configured, all /api/analytics/* endpoints return 404 (no routes registered)
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  const honoWithAnalytics = analyticsEnabled
    ? chainAnalyticsRoutes(
        honoWithActivity,
        app.name,
        typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined,
        typeof app.analytics === 'object' ? app.analytics.excludedPaths : undefined,
        typeof app.analytics === 'object' ? app.analytics.respectDoNotTrack : undefined
      )
    : honoWithActivity

  // Chain automation routes (webhook triggers + run history listing)
  // Always registered: when no automations are configured, /api/automations/*
  // returns 404 by virtue of automation lookup failing inside the handler.
  const honoWithAutomations = chainAutomationRoutes(honoWithAnalytics, app)

  // Chain notification inbox + preferences + subscriptions routes.
  // Always registered: handlers return 401 when no session is present.
  // The preferences GET handler reads `app.notifications.templates` to
  // derive default channel toggles, hence the `app` param.
  const honoWithNotifications = chainNotificationRoutes(honoWithAutomations, app)

  // Chain OAuth2 connection routes (authorize, callback, status, disconnect).
  // Reads `app.connections[]` for provider configuration; per-user tokens
  // persist to system.connection_tokens encrypted at rest.
  const honoWithConnections = chainConnectionRoutes(honoWithNotifications, app)

  // Chain share-link routes (admin CRUD + public resolve + password auth +
  // public form submission). Persists to system.share_links and
  // system.form_submissions. Form submissions are IP-rate-limited (10/min)
  // and write a record into the configured target table.
  const honoWithShareLinks = chainShareLinkRoutes(honoWithConnections, app)

  // Chain bucket routes (file access with per-bucket public/private enforcement)
  const honoWithBuckets = chainBucketRoutes(honoWithShareLinks, app)

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
  const honoWithAdmin = chainAdminRoutes(honoWithForms)

  // Chain generic AI chat route (POST /api/ai/chat). Always registered;
  // when AI is not configured (`AI_PROVIDER` unset) the handler returns
  // 503 with a JSON error envelope. Auth gating (401 when unauthenticated)
  // is applied above via `authMiddleware + requireAuth` on `/api/ai/chat`.
  const honoWithAiChat = chainAiChatRoutes(honoWithAdmin)

  // Chain AI MCP cross-cutting status routes (X-1). Always registered: when
  // MCP_SERVER_ENABLED / MCP_ENABLED / MCP_CLIENT_SERVERS env vars are unset
  // the GET handlers return JSON 404 so the API shape stays stable. The
  // server's actual JSON-RPC `/mcp` route is mounted separately by
  // `setupMcpRoutes` and is gated by `MCP_ENABLED` (default-off).
  const honoWithAiMcpStatus = chainAiMcpStatusRoutes(honoWithAiChat, app)

  // Chain active-scope session routes (P-6). Always registered: when
  // `auth.scopeTables` is unset, handlers return 404 — keeping the API
  // shape stable across configurations. Session validation lives inside
  // the handlers so 401 / 403 / 404 can be distinguished cleanly per spec.
  const honoWithActiveScope = chainActiveScopeRoutes(honoWithAiMcpStatus, app)

  // Chain auth routes (role manipulation prevention)
  return chainAuthRoutes(honoWithActiveScope, auth)
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
