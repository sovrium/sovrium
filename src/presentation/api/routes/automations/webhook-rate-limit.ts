/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Webhook per-trigger + per-IP rate limiter (in-memory sliding window).
 *
 * Mirrors the pattern used by `auth-route-utils.ts` — a process-local Map
 * of recent timestamps. The same caveats apply: this is suitable only for
 * single-process deployments; horizontal scale-out requires a shared store
 * (Redis, etc.). The webhook spec covers the local-process behaviour, so
 * shipping the in-memory limiter unblocks T-1 without forcing a Redis
 * dependency on every Sovrium deployment.
 */

type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

interface RateLimitEntry {
  readonly timestamps: ReadonlyArray<number>
}

const rateLimitState = new Map<string, RateLimitEntry>()

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
  const entry = rateLimitState.get(key)
  const recent = (entry?.timestamps ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= config.maxRequests) {
    const oldest = Math.min(...recent)
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return { limited: true, retryAfter }
  }
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable state, mirrored from auth-route-utils
  rateLimitState.set(key, { timestamps: [...recent, now] })
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
