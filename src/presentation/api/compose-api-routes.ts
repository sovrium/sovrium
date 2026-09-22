/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE `/api/*` chain.
 *
 * One expression registers every API route in one order, because Hono RPC type
 * inference requires method chaining rather than `.route()` mounting. Anything
 * with a life of its own has been lifted out — the boot-state resets, the eco
 * stack, the request guards, the health handler, the authorisation gates and
 * the `/api/admin/*` family all live beside this file — so what is left is the
 * SEQUENCE, which is the thing that cannot be split.
 */

import { linkTargets } from '@/domain/models/app/links'
import { createAvatarProfileStore } from '@/infrastructure/auth/better-auth/avatar-profile-store'
import { FormRenderers } from '@/infrastructure/layers/form-renderer-layer'
import { resetBootState } from '@/infrastructure/server/middleware/boot-state-reset'
import { applyEcoStack } from '@/infrastructure/server/middleware/eco-stack'
import { chainActiveScopeRoutes } from '@/presentation/api/admin/active-scope-routes'
import { chainUserDirectoryRoutes } from '@/presentation/api/admin/user-directory-routes'
import { chainAgentApprovalRoutes } from '@/presentation/api/agents/approval-routes'
import { chainAgentScheduleRoutes } from '@/presentation/api/agents/schedule-routes'
import { chainAiChatRoutes } from '@/presentation/api/ai/chat-routes'
import { chainAiFactsRoutes } from '@/presentation/api/ai/facts-memory-routes'
import { chainAiMcpStatusRoutes } from '@/presentation/api/ai/mcp-status-routes'
import { chainRagRoutes } from '@/presentation/api/ai/rag-routes'
import { chainAnalyticsRoutes } from '@/presentation/api/analytics/routes'
import { chainAccountRoutes } from '@/presentation/api/auth/account-routes'
import { chainAuthRoutes } from '@/presentation/api/auth/routes'
import { chainAutomationRoutes } from '@/presentation/api/automations/routes'
import { chainBucketRoutes } from '@/presentation/api/buckets/routes'
import { chainConnectionRoutes } from '@/presentation/api/connections/routes'
import { chainFormRoutes } from '@/presentation/api/forms/routes'
import { authMiddleware } from '@/presentation/api/middleware/auth'
import { commandSearchRateLimitMiddleware } from '@/presentation/api/search/command-search-rate-limit'
import { chainFavoriteRoutes } from '@/presentation/api/search/favorites-routes'
import { chainRecentRoutes } from '@/presentation/api/search/recent-routes'
import { chainCommandSearchRoutes } from '@/presentation/api/search/routes'
import { chainActivityRoutes } from '@/presentation/api/tables/activity-feed-routes'
import { chainRealtimeRoutes } from '@/presentation/api/tables/realtime-routes'
import { chainTableRoutes } from '@/presentation/api/tables/routes'
import { chainSharedViewRoute } from '@/presentation/api/tables/user-view-routes'
import { chainAdminApiRoutes } from './admin/routes'
import { applyApiAuthGuards } from './middleware/api-auth-guards'
import { getLiveApp } from './runtime/live-app-store'
import { handleHealthCheck } from './server/health-routes'
import type { App } from '@/domain/models/app'
// Type-only: the value arrives as the `auth` parameter of `createApiRoutes`.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Hono } from 'hono'

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
export const createApiRoutes = <T extends Hono>(
  app: App,

  honoApp: T,
  // Built once in `createHonoApp` and passed in. It used to be constructed
  // here, unconditionally, which loaded the Better Auth package on every boot
  // even though every use below sits behind an `app.auth` branch. `undefined`
  // exactly when `app.auth` is absent.
  auth?: Readonly<ReturnType<typeof createAuthInstance>>
) => {
  // Reset every in-process singleton that must not outlive this boot.
  resetBootState()

  // Eco middleware stack + the low-data opt-out route, in mount order.
  const honoWithEcoHeader = applyEcoStack(honoApp)

  // Create health check endpoint
  const honoWithHealth = honoWithEcoHeader.get('/api/health', async (c) =>
    handleHealthCheck(c, app)
  )

  // Transport guards, rate limits, session extraction and every per-path
  // authorisation gate — applied as one block, in the order that is the
  // contract. See `api-auth-guards.ts`.
  const honoWithAuth = applyApiAuthGuards(honoWithHealth, app, auth)

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

  // Every `/api/admin/*` read, chained in one place. See `api-admin-routes.ts`.
  const honoWithAdminLinks = chainAdminApiRoutes(honoWithForms, app, resolveLiveApp)

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
    auth !== undefined
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
