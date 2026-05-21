/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import { bodyLimit } from 'hono/body-limit'
import { timeout } from 'hono/timeout'
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
} from '@/presentation/api/routes'
import { chainCommandSearchRoutes } from '@/presentation/api/routes/command-search'
import { chainConnectionRoutes } from '@/presentation/api/routes/connections'
import { chainFavoriteRoutes } from '@/presentation/api/routes/favorites'
import { chainNotificationRoutes } from '@/presentation/api/routes/notifications'
import { chainRecentRoutes } from '@/presentation/api/routes/recent'
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
import { getLiveApp } from './live-app-store'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

class HealthResponseValidationError extends Data.TaggedError('HealthResponseValidationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

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

      recordTablesRateLimitRequest(method, path, ip)

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

      recordTablesRateLimitRequest(method, path, ip)

      await next()
    })
}

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

      recordActivityRateLimitRequest(method, path, ip)

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

      recordActivityRateLimitRequest(method, path, ip)

      await next()
    })
}

const envInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const STREAMING_PREFIXES = ['/api/ai/chat/stream'] as const

const applyRequestGuards = (honoApp: Hono): Hono => {
  const timeoutMs = envInt('API_TIMEOUT_MS', 30_000)
  const bodyLimitBytes = envInt('API_BODY_LIMIT_BYTES', 25 * 1024 * 1024)

  const timeoutMiddleware = timeout(timeoutMs)

  return honoApp
    .use('/api/*', async (c, next) => {
      if (STREAMING_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
        return next()
      }
      return timeoutMiddleware(c, next)
    })
    .use('/api/tables/*', bodyLimit({ maxSize: bodyLimitBytes }))
}

export const createApiRoutes = <T extends Hono>(app: App, honoApp: T) => {
  const auth = createAuthInstance(app.auth)

  const honoWithHealth = honoApp.get('/api/health', async (c) => {
    const program = Effect.gen(function* () {
      const ollamaReachable = yield* Effect.promise(() =>
        probeOllamaReachable(resolveOllamaBaseUrl(process.env))
      )
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        app: {
          name: getLiveApp()?.name ?? app.name,
        },
        ai: buildAiHealthStatusWithEcoRouting(process.env, ollamaReachable, app.agents ?? []),
      }

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
      const data = await Effect.runPromise(program)
      return c.json(data, 200)
    } catch {
      return c.json(
        {
          error: 'Internal server error',
          code: 'HEALTH_CHECK_FAILED',
        },
        500
      )
    }
  })

  const honoWithGuards = applyRequestGuards(honoWithHealth)

  const honoWithTablesRateLimit = applyTablesRateLimitMiddleware(honoWithGuards)
  const honoWithActivityRateLimit = applyActivityRateLimitMiddleware(honoWithTablesRateLimit)

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
        .use('/api/admin/storage/transform-cache', authMiddleware(auth))
        .use('/api/admin/storage/transform-cache', requireAuth())
        .use('/api/admin/storage/transform-cache', requireAdmin())
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
        .use('/api/automations/*', authMiddleware(auth))
        .use('/api/automations', authMiddleware(auth))
        .use('/api/automations', requireAuth())
        .use('/api/buckets/*', authMiddleware(auth))
        .use('/api/connections/*', authMiddleware(auth))
        .use('/api/session/active-scope/:tableSlug', authMiddleware(auth))
        .use('/api/ai/chat', authMiddleware(auth))
        .use('/api/ai/chat', requireAuth())
        .use('/api/ai/chat/stream', authMiddleware(auth))
        .use('/api/ai/chat/stream', requireAuth())
        .use('/api/ai/conversations', authMiddleware(auth))
        .use('/api/ai/conversations', requireAuth())
        .use('/api/ai/conversations/*', authMiddleware(auth))
        .use('/api/ai/conversations/*', requireAuth())
        .use('/api/agents/*', authMiddleware(auth))
        .use('/api/account/*', authMiddleware(auth))
        .use('/api/favorites', authMiddleware(auth))
        .use('/api/recent', authMiddleware(auth))
        .use('/api/command-search', authMiddleware(auth))
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

  const honoWithTables = chainTableRoutes(honoWithAuth, app)

  const honoWithActivity = chainActivityRoutes(honoWithTables)

  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  const honoWithAnalytics = analyticsEnabled
    ? chainAnalyticsRoutes(honoWithActivity, {
        appName: app.name,
        retentionDays: typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined,
        excludedPaths: typeof app.analytics === 'object' ? app.analytics.excludedPaths : undefined,
        respectDoNotTrack:
          typeof app.analytics === 'object' ? app.analytics.respectDoNotTrack : undefined,
      })
    : honoWithActivity

  const honoWithAutomations = chainAutomationRoutes(honoWithAnalytics, app)

  const honoWithNotifications = chainNotificationRoutes(honoWithAutomations, app)

  const honoWithConnections = chainConnectionRoutes(honoWithNotifications, app)

  const honoWithShareLinks = chainShareLinkRoutes(honoWithConnections, app)

  const honoWithBuckets = chainBucketRoutes(honoWithShareLinks, app)

  const honoWithForms = chainFormRoutes(honoWithBuckets, app, FormRenderers)

  const honoWithAdmin = chainAdminRoutes(honoWithForms)

  const honoWithAiChat = chainAiChatRoutes(honoWithAdmin, app)

  const honoWithAgents = chainAgentScheduleRoutes(
    chainAgentApprovalRoutes(chainAiMcpStatusRoutes(honoWithAiChat, app), app),
    app
  )

  const honoWithRag = chainRagRoutes(
    app.auth !== undefined
      ? (honoWithAgents
          .use('/api/ai/rag/rebuild', authMiddleware(auth))
          .use('/api/ai/agents/*', authMiddleware(auth)) as typeof honoWithAgents)
      : honoWithAgents,
    app
  )

  const honoWithAiFacts = chainAiFactsRoutes(honoWithRag, app)

  const honoWithActiveScope = chainActiveScopeRoutes(honoWithAiFacts, app)

  const honoWithAccount = chainAccountRoutes(honoWithActiveScope, app)

  const honoWithFavorites = chainFavoriteRoutes(honoWithAccount)

  const honoWithRecent = chainRecentRoutes(honoWithFavorites)
  const honoWithCommandSearch = chainCommandSearchRoutes(honoWithRecent, app)

  return chainAuthRoutes(honoWithCommandSearch, auth)
}

export type ApiType = ReturnType<typeof createApiRoutes<Hono>>
