/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createSlidingWindowLimiter } from '@/infrastructure/utils/sliding-window-limiter'
import type { App } from '@/domain/models/app'


type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

const limiter = createSlidingWindowLimiter()

const rateLimitKey = (automationName: string, ip: string): string => `${automationName}:${ip}`

export interface RateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
}

export const isRateLimited = (
  automationName: string,
  ip: string,
  config: { readonly maxRequests: number; readonly windowSeconds: number }
): RateLimitDecision => {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const key = rateLimitKey(automationName, ip)
  const recent = limiter.getRecent(key, windowMs)
  if (recent.length >= config.maxRequests) {
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }
  limiter.record(key, { windowMs, maxRequests: config.maxRequests })
  return { limited: false, retryAfter: 0 }
}

export const normalizeRateLimit = (
  config: NonNullable<WebhookTrigger['rateLimit']>
): { readonly maxRequests: number; readonly windowSeconds: number } | undefined => {
  const { maxRequests } = config
  const windowSeconds = config.windowSeconds ?? config.window
  if (maxRequests === undefined || windowSeconds === undefined) return undefined
  return { maxRequests, windowSeconds }
}
