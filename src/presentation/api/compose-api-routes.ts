/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE `/api/*` sequence.
 *
 * Every API route family registers here, in one order, as one row of a table.
 * The ORDER is the contract: Hono runs middleware registered with `.use()`
 * only for routes registered AFTER it, so the request guards and per-path
 * authorisation gates (`api-auth-guards.ts`) come first and every family row
 * follows them. Anything with a life of its own has been lifted out — the
 * boot-state resets, the eco stack, the request guards, the health handler,
 * the authorisation gates and the `/api/admin/*` family all live beside this
 * file — so what is left is the SEQUENCE.
 *
 * No client reads a type off this composition. The islands' typed RPC client
 * reads the three table slugs' own method chains (`api/client.ts`), so method
 * chaining for type inference lives inside those slugs and nowhere here.
 */

import { resolveAnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import { resolvePrivacySignals } from '@/domain/models/app/analytics/privacy-signals-service'
import { linkTargets } from '@/domain/models/app/links'
import { createAvatarProfileStore } from '@/infrastructure/auth/better-auth/avatar-profile-store'
import { FormRenderers } from '@/infrastructure/layers/form-renderer-layer'
import { resetBootState } from '@/infrastructure/server/middleware/boot-state-reset'
import { applyEcoStack } from '@/infrastructure/server/middleware/eco-stack'
import { chainActiveScopeRoutes } from '@/presentation/api/admin/active-scope-routes'
import { chainUserDirectoryRoutes } from '@/presentation/api/admin/user-directory-routes'
import { chainAgentApprovalRoutes } from '@/presentation/api/agents/approval-routes'
import { chainAiChatElicitationRoutes } from '@/presentation/api/agents/chat-elicitation-routes'
import { chainAiChatRoutes } from '@/presentation/api/agents/chat-routes'
import { chainAiConversationBranchRoutes } from '@/presentation/api/agents/conversation-branch-routes'
import { chainAiFactsRoutes } from '@/presentation/api/agents/facts-memory-routes'
import { chainAiMcpStatusRoutes } from '@/presentation/api/agents/mcp-status-routes'
import { chainRagRoutes } from '@/presentation/api/agents/rag-routes'
import { chainAgentScheduleRoutes } from '@/presentation/api/agents/schedule-routes'
import { chainAiChatAttachmentRoutes } from '@/presentation/api/ai/attachment-routes'
import { chainAiTranscriptionRoutes } from '@/presentation/api/ai/transcription-routes'
import { chainAnalyticsRoutes } from '@/presentation/api/analytics/routes'
import { chainAccountRoutes } from '@/presentation/api/auth/account-routes'
import { chainExpiredAuthRowsRoutes } from '@/presentation/api/auth/expired-rows-routes'
import { chainAuthRoutes } from '@/presentation/api/auth/routes'
import { chainScimRoutes } from '@/presentation/api/auth/scim-routes'
import { chainEmailLinkRoutes } from '@/presentation/api/automations/email-link-routes'
import { chainNotificationRoutes } from '@/presentation/api/automations/notification-routes'
import { chainNotificationTriggerRoutes } from '@/presentation/api/automations/notification-trigger-routes'
import { chainAutomationRoutes } from '@/presentation/api/automations/routes'
import { chainRunRetentionRoutes } from '@/presentation/api/automations/run-retention-routes'
import { chainBucketRoutes } from '@/presentation/api/buckets/routes'
import { chainConnectionRoutes } from '@/presentation/api/connections/routes'
import { chainFormRoutes } from '@/presentation/api/forms/routes'
import { authMiddleware, requireAuth } from '@/presentation/api/middleware/auth'
import { callerTableReaders } from '@/presentation/api/pages/caller-table-reader'
import { commandSearchRateLimitMiddleware } from '@/presentation/api/search/command-search-rate-limit'
import { chainFavoriteRoutes } from '@/presentation/api/search/favorites-routes'
import { type PageReaderResolver } from '@/presentation/api/search/page-reader'
import { chainPageSearchRoutes } from '@/presentation/api/search/page-search-routes'
import { chainRecentRoutes } from '@/presentation/api/search/recent-routes'
import { chainCommandSearchRoutes } from '@/presentation/api/search/routes'
import { chainActivityRoutes } from '@/presentation/api/tables/activity-feed-routes'
import { chainRealtimeRoutes } from '@/presentation/api/tables/realtime-routes'
import { chainTableRoutes } from '@/presentation/api/tables/routes'
import { chainTableRetentionRoutes } from '@/presentation/api/tables/table-retention-routes'
import { chainWebhookOutboxRoutes } from '@/presentation/api/tables/webhook-outbox-routes'
import { chainAdminApiRoutes } from './admin/routes'
import { applyApiAuthGuards } from './middleware/api-auth-guards'
import { handleHealthCheck } from './server/health-routes'
import type { App } from '@/domain/models/app'
// Type-only: the value arrives as the `auth` parameter of `createApiRoutes`.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Hono } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/**
 * One row of the sequence: registers its routes or middleware on the app.
 * Hono's `get`/`use`/`on`/`route` register on the instance they are called on
 * and return it, so every row writes the SAME app and nothing is threaded
 * through. A row's return value is ignored.
 */
type RouteStep = (hono: Hono) => unknown

/**
 * The analytics family's settings, or `undefined` when analytics is off (not
 * configured, or `false`): then no `/api/analytics/*` route is registered and
 * every such path answers 404.
 */
const analyticsRouteConfig = (app: App) => {
  if (app.analytics === undefined || app.analytics === false) return undefined
  const settings = typeof app.analytics === 'object' ? app.analytics : undefined
  return {
    appName: app.name,
    retentionDays: settings?.retentionDays,
    excludedPaths: settings?.excludedPaths,
    // Both default to true: an unset key honours the signal, as documented.
    ...resolvePrivacySignals(app.analytics),
    // `audience-only` unless the operator wrote `profile: full`.
    profile: resolveAnalyticsProfile(app.analytics),
    // Lets `/api/analytics/targets` name the destination each recorded
    // `targetIndex` resolves to; an index the current list no longer covers
    // reports null rather than being dropped from the split.
    resolveLinks: () =>
      (app.links ?? []).map((link) => ({
        slug: link.slug,
        destinations: linkTargets(link).map((target) => target.to),
      })),
    // The read endpoints admit the app's top role beside `admin`.
    app,
  }
}

/**
 * The session the RAG and agent-facts routes judge. `rebuild` and `search`
 * enforce their own gates inside `agents/rag-routes.ts` (so 401 stays distinguishable
 * from 403/404), which requires the session to be ATTACHED first — without
 * the middleware a gate reads no session even for a caller holding a valid
 * cookie, and would 401 every caller. `config` and `status` name the knowledge
 * directory's files and the embedding model, so they require a session
 * outright. Nothing is registered without auth.
 */
const guardRagRoutes = (hono: Hono, auth: AuthInstance | undefined): void => {
  if (auth === undefined) return
  hono
    .use('/api/ai/rag/rebuild', authMiddleware(auth))
    .use('/api/ai/rag/search', authMiddleware(auth))
    .use('/api/ai/rag/status', authMiddleware(auth))
    .use('/api/ai/rag/config', authMiddleware(auth))
    .use('/api/ai/agents/*', authMiddleware(auth))
    .use('/api/ai/rag/status', requireAuth())
    .use('/api/ai/rag/config', requireAuth())
}

/**
 * Every `/api/*` registration, in order. Each family is always registered
 * unless its row says otherwise; a family whose entity is not declared answers
 * 404 from its handler, so the API shape stays stable across configurations.
 */
const apiRouteSteps = (
  app: App,
  auth: AuthInstance | undefined,
  getSession: PageReaderResolver | undefined
): readonly RouteStep[] => {
  const analytics = analyticsRouteConfig(app)
  return [
    applyEcoStack,
    (hono) => hono.get('/api/health', async (c) => handleHealthCheck(c, app, auth)),
    // Transport guards, rate limits, session extraction and every per-path
    // authorisation gate, as one block, ahead of every family below.
    (hono) => applyApiAuthGuards(hono, app, auth),
    // Tables first: the session is on `c.var.session`; `app` maps tableId → name.
    (hono) => chainTableRoutes(hono, app),
    (hono) => chainActivityRoutes(hono, app),
    (hono) => (analytics === undefined ? hono : chainAnalyticsRoutes(hono, analytics)),
    // Webhook triggers + run history; an unknown automation is a handler 404.
    (hono) => chainAutomationRoutes(hono, app, getSession),
    chainEmailLinkRoutes,
    // OAuth2 connections: `app.connections[]` configures providers; per-user
    // tokens persist to system.connection_tokens, encrypted at rest.
    (hono) => chainConnectionRoutes(hono, app),
    // Files, with per-bucket public/private enforcement.
    (hono) => chainBucketRoutes(hono, app),
    // Standalone forms (GET /forms/:name, custom-path aliases, submissions).
    // The renderers are injected here, at the composition root, because the
    // presentation route file cannot import the React renderer under the layer
    // rules; the caller's table answer narrows a form page as an embedded form.
    (hono) =>
      chainFormRoutes(hono, app, {
        ...FormRenderers,
        readTableAsCaller: (c) => callerTableReaders(c).readTableAsCaller,
      }),
    // Every `/api/admin/*` read. See `admin/routes.ts`.
    (hono) => chainAdminApiRoutes(hono, app),
    // AI chat (503 when no `AI_PROVIDER`), dictation, attachments, answering an
    // agent's question, then editing a question / regenerating an answer.
    (hono) => chainAiChatRoutes(hono, app),
    (hono) => chainAiTranscriptionRoutes(hono, app),
    (hono) => chainAiChatAttachmentRoutes(hono, app),
    chainAiChatElicitationRoutes,
    (hono) => chainAiConversationBranchRoutes(hono, app),
    // MCP status (JSON 404 while the MCP env vars are unset; the JSON-RPC
    // `/mcp` route is `setupMcpRoutes`'), agent execution + approvals, schedules.
    (hono) => chainAiMcpStatusRoutes(hono, app),
    (hono) => chainAgentApprovalRoutes(hono, app),
    (hono) => chainAgentScheduleRoutes(hono, app),
    (hono) => guardRagRoutes(hono, auth),
    (hono) => chainRagRoutes(hono, app),
    // Per-agent learned facts, behind the `/api/ai/agents/*` session above.
    (hono) => chainAiFactsRoutes(hono, app),
    // Session validation lives in the handlers, so 401/403/404 stay distinct.
    (hono) => chainActiveScopeRoutes(hono, app),
    // Account self-service + GDPR export, delete and the purge-due scheduler.
    (hono) => chainAccountRoutes(hono, app, createAvatarProfileStore(auth)),
    // Internal scheduler triggers: operator notifications, the webhook outbox,
    // table and run-history retention, expired sign-in rows. 404 without the
    // scheduler token.
    (hono) => chainNotificationTriggerRoutes(hono, app),
    (hono) => chainWebhookOutboxRoutes(hono, app),
    (hono) => chainTableRetentionRoutes(hono, app),
    chainRunRetentionRoutes,
    chainExpiredAuthRowsRoutes,
    (hono) => chainFavoriteRoutes(hono, app),
    (hono) => chainNotificationRoutes(hono, app),
    (hono) => chainUserDirectoryRoutes(hono, app),
    (hono) => chainRecentRoutes(hono, app),
    // The palette's per-IP ceiling, ahead of its handlers and outside the auth
    // guards: both routes are reachable anonymously, so the limiter must hold
    // with and without auth, and a refused request never reaches the fan-out.
    (hono) =>
      hono
        .use('/api/command-search', commandSearchRateLimitMiddleware)
        .use('/api/search/pages', commandSearchRateLimitMiddleware),
    (hono) => chainCommandSearchRoutes(hono, app, getSession),
    (hono) => chainPageSearchRoutes(hono, app, getSession),
    (hono) => chainRealtimeRoutes(hono, app, getSession),
    // SCIM provisioning, registered only when `auth.scim` is declared.
    (hono) => chainScimRoutes(hono, app, auth),
    // Role-manipulation prevention.
    (hono) => chainAuthRoutes(hono, app, auth),
  ]
}

/**
 * Register every `/api/*` route on `honoApp`, in the order that is the contract.
 *
 * @param app - Validated application configuration from AppSchema
 * @param honoApp - Hono instance to register the routes on
 * @param auth - Built once in `createHonoApp` and passed in, so Better Auth is
 *   not loaded on a boot without `app.auth`. `undefined` exactly then.
 * @param getSession - The router's own session reader, so the page searches
 *   filter by the same `checkPageAccess` input a visit is judged on.
 * @returns `honoApp`, with every API route registered
 */
export const createApiRoutes = (
  app: App,
  honoApp: Hono,
  auth?: AuthInstance,
  getSession?: PageReaderResolver
): Hono => {
  // Reset every in-process singleton that must not outlive this boot.
  resetBootState()
  apiRouteSteps(app, auth, getSession).forEach((step) => step(honoApp))
  return honoApp
}
