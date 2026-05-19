/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createSlidingWindowLimiter } from '@/infrastructure/utils/sliding-window-limiter'

const limiter = createSlidingWindowLimiter()

const DEFAULT_WINDOW_SECONDS = 60

interface ChatRateLimitConfig {
  readonly limit: number | undefined
  readonly windowSeconds: number
}

const parsePositiveInt = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) return undefined
  return value
}

export const resolveChatRateLimitConfig = (): ChatRateLimitConfig => ({
  limit: parsePositiveInt(process.env.AI_CHAT_RATE_LIMIT),
  windowSeconds: parsePositiveInt(process.env.AI_CHAT_RATE_WINDOW) ?? DEFAULT_WINDOW_SECONDS,
})

export interface ChatRateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
  readonly remaining: number
  readonly limit: number | undefined
}

export const checkChatRateLimit = (principalKey: string): ChatRateLimitDecision => {
  const { limit, windowSeconds } = resolveChatRateLimitConfig()

  if (limit === undefined) {
    return { limited: false, retryAfter: 0, remaining: Number.MAX_SAFE_INTEGER, limit: undefined }
  }

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const recent = limiter.getRecent(principalKey, windowMs)

  if (recent.length >= limit) {
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter, remaining: 0, limit }
  }

  limiter.record(principalKey, { windowMs, maxRequests: limit })
  return { limited: false, retryAfter: 0, remaining: Math.max(0, limit - recent.length - 1), limit }
}
