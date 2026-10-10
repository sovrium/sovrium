/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * Webhook per-trigger + per-IP rate limiter (in-memory sliding window).
 *
 * Built on the shared `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/utils/sliding-window-limiter`) — a process-local Map of
 * recent timestamps. The same caveats apply: this is suitable only for
 * single-process deployments; horizontal scale-out requires a shared store
 * (Redis, etc.). The webhook spec covers the local-process behaviour, so
 * shipping the in-memory limiter unblocks T-1 without forcing a Redis
 * dependency on every Sovrium deployment.
 */
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

const limiter = createSlidingWindowLimiter()

const rateLimitKey = (automationName: string, ip: string): string => `${automationName}:${ip}`

export interface RateLimitDecision {
  readonly limited: boolean
  readonly retryAfter: number
}

type SlidingWindowLimiter = ReturnType<typeof createSlidingWindowLimiter>

type WindowConfig = { readonly maxRequests: number; readonly windowSeconds: number }

/** Whether `key` is over `config`, without recording anything. */
const check = (
  windows: SlidingWindowLimiter,
  key: string,
  config: WindowConfig,
  now: number
): RateLimitDecision => {
  const windowMs = config.windowSeconds * 1000
  const recent = windows.getRecent(key, windowMs, now)
  if (recent.length < config.maxRequests) return { limited: false, retryAfter: 0 }
  // `Math.max(1, …)` floors retry-after at 1s (the shared primitive's
  // getRetryAfter floors at 0s).
  const oldest = Math.min(...recent)
  return { limited: true, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) }
}

const decide = (
  windows: SlidingWindowLimiter,
  key: string,
  config: WindowConfig
): RateLimitDecision => {
  const now = Date.now()
  const decision = check(windows, key, config, now)
  // Limited attempts are NOT recorded.
  if (decision.limited) return decision
  windows.record(
    key,
    { windowMs: config.windowSeconds * 1000, maxRequests: config.maxRequests },
    now
  )
  return decision
}

export const isRateLimited = (
  automationName: string,
  ip: string,
  config: WindowConfig
): RateLimitDecision => decide(limiter, rateLimitKey(automationName, ip), config)

/**
 * One telemetry ingest budget per server (`rateLimit.per`, G6). A protocol
 * request is counted ONCE, against the strictest budget of the receivers it
 * reaches, under a key naming the protocol and the sender (`project:<id>`) or
 * its address (`ip:<address>`). The windows are held per `scope` — the
 * server's own app — so one boot's traffic never counts against the next in a
 * process that boots several.
 */
const ingestLimiters = new WeakMap<object, SlidingWindowLimiter>()

const ingestWindowsOf = (scope: object): SlidingWindowLimiter => {
  const existing = ingestLimiters.get(scope)
  if (existing !== undefined) return existing
  const created = createSlidingWindowLimiter()
  ingestLimiters.set(scope, created)
  return created
}

export const isIngestRateLimited = (
  scope: object,
  key: string,
  config: WindowConfig
): RateLimitDecision => decide(ingestWindowsOf(scope), key, config)

/**
 * The refusal budget of telemetry ingest: per source address
 * (`getRequestRateLimitKey`), {@link REFUSAL_BUDGET} requests no key admits —
 * a missing key, or a key no row holds. Held in the same per-scope windows as
 * the ingest budgets, under `refusal:<address>`. A key found in the key table
 * within the last ten minutes is never counted nor refused by it: the handler
 * asks only for the others. Fixed rather than configurable — a healthy sender
 * is never refused, so the number only bounds a misconfiguration or an attack.
 *
 * Split in two so the handler can refuse BEFORE a lookup: {@link refusalBudgetSpent}
 * only checks, {@link recordRefusal} counts one refusal. An attempt answered
 * 429 is not recorded, as with every budget here.
 */
export const REFUSAL_BUDGET: WindowConfig = { maxRequests: 60, windowSeconds: 60 }

const refusalKey = (address: string): string => `refusal:${address}`

/** Whether `address` has spent its refusal budget (checks, records nothing). */
export const refusalBudgetSpent = (scope: object, address: string): RateLimitDecision =>
  check(ingestWindowsOf(scope), refusalKey(address), REFUSAL_BUDGET, Date.now())

/** Count one refusal against `address`. */
export const recordRefusal = (scope: object, address: string): void => {
  ingestWindowsOf(scope).record(refusalKey(address), {
    windowMs: REFUSAL_BUDGET.windowSeconds * 1000,
    maxRequests: REFUSAL_BUDGET.maxRequests,
  })
}

export const normalizeRateLimit = (
  config: NonNullable<WebhookTrigger['rateLimit']>
): WindowConfig | undefined => {
  const { maxRequests } = config
  const windowSeconds = config.windowSeconds ?? config.window
  if (maxRequests === undefined || windowSeconds === undefined) return undefined
  return { maxRequests, windowSeconds }
}
