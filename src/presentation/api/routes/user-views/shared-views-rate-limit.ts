/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createSlidingWindowLimiter } from '@/infrastructure/utils/sliding-window-limiter'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { MiddlewareHandler } from 'hono'

const limiter = createSlidingWindowLimiter()

const DEFAULT_WINDOW_MS = 60_000

const DEFAULT_MAX_REQUESTS = 60

interface SharedViewsRateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

const parsePositiveInt = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) return undefined
  return value
}

export const resolveSharedViewsRateLimitConfig = (): SharedViewsRateLimitConfig => ({
  windowMs: parsePositiveInt(process.env.SHARED_VIEWS_RATE_LIMIT_WINDOW_MS) ?? DEFAULT_WINDOW_MS,
  maxRequests: parsePositiveInt(process.env.SHARED_VIEWS_RATE_LIMIT_MAX) ?? DEFAULT_MAX_REQUESTS,
})

export interface SharedViewsRateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
}

export const checkSharedViewsRateLimit = (userId: string): SharedViewsRateLimitDecision => {
  const { windowMs, maxRequests } = resolveSharedViewsRateLimitConfig()
  const now = Date.now()
  const recent = limiter.getRecent(userId, windowMs)

  if (recent.length >= maxRequests) {
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }

  limiter.record(userId, { windowMs, maxRequests })
  return { limited: false, retryAfter: 0 }
}

export const sharedViewsRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const { session } = (c as ContextWithSession).var
  if (!session) {
    await next()
    return
  }

  const decision = checkSharedViewsRateLimit(session.userId)
  if (decision.limited) {
    return c.json(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      },
      429,
      { 'Retry-After': decision.retryAfter.toString() }
    )
  }

  await next()
}
