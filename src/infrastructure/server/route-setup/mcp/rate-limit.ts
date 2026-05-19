/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context } from 'hono'
import type { McpCaller } from '@/infrastructure/server/route-setup/mcp/auth'



const ONE_MINUTE_MS = 60_000
const ONE_DAY_MS = 86_400_000


interface RateLimitState {
  readonly perMinute: ReadonlyArray<number>
  readonly perDay: ReadonlyArray<number>
}

const rateLimitState = new Map<string, RateLimitState>()

const pruneTimestamps = (
  timestamps: ReadonlyArray<number>,
  windowMs: number,
  now: number
): ReadonlyArray<number> => timestamps.filter((t) => now - t < windowMs)

export const resetMcpRateLimitState = (): void => {
  rateLimitState.clear()
}


export const deriveMcpCallerKey = (caller: Readonly<McpCaller>, bearerToken: string): string => {
  if (caller.userId !== undefined && caller.userId.length > 0) {
    return `user:${caller.userId}`
  }
  return `token:${bearerToken}`
}


export interface McpRateLimitConfig {
  readonly perMinute: number
  readonly perDay: number
}

interface WindowInfo {
  readonly limit: number
  readonly remaining: number
  readonly resetAtSec: number
  readonly retryAfterSec: number
  readonly exceeded: boolean
}

const computeWindowInfo = (
  timestamps: ReadonlyArray<number>,
  limit: number,
  windowMs: number,
  now: number
): WindowInfo => {
  const remaining = Math.max(0, limit - timestamps.length)
  const exceeded = timestamps.length >= limit

  const oldestInWindow = timestamps.length > 0 ? Math.min(...timestamps) : now
  const resetAtMs = oldestInWindow + windowMs
  const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - now) / 1000))
  const resetAtSec = Math.ceil(resetAtMs / 1000)

  return { limit, remaining, resetAtSec, retryAfterSec, exceeded }
}

const pickBindingWindow = (perMinute: WindowInfo, perDay: WindowInfo): WindowInfo => {
  if (perDay.remaining < perMinute.remaining) return perDay
  return perMinute
}


export interface McpRateLimitResult {
  readonly headers: Readonly<Record<string, string>>
  readonly retryAfterSec: number
  readonly exceeded: boolean
}

export const checkMcpRateLimit = (
  callerKey: string,
  config: Readonly<McpRateLimitConfig>,
  now: number = Date.now()
): McpRateLimitResult => {
  const existing = rateLimitState.get(callerKey)
  const minutePruned = existing ? pruneTimestamps(existing.perMinute, ONE_MINUTE_MS, now) : []
  const dayPruned = existing ? pruneTimestamps(existing.perDay, ONE_DAY_MS, now) : []

  const minuteInfo = computeWindowInfo(minutePruned, config.perMinute, ONE_MINUTE_MS, now)
  const dayInfo = computeWindowInfo(dayPruned, config.perDay, ONE_DAY_MS, now)
  const binding = pickBindingWindow(minuteInfo, dayInfo)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(binding.limit),
    'X-RateLimit-Remaining': String(binding.remaining),
    'X-RateLimit-Reset': String(binding.resetAtSec),
  }

  return {
    headers,
    retryAfterSec: binding.retryAfterSec,
    exceeded: minuteInfo.exceeded || dayInfo.exceeded,
  }
}

export const recordMcpRequest = (callerKey: string, now: number = Date.now()): void => {
  const existing = rateLimitState.get(callerKey)
  const minutePruned = existing ? pruneTimestamps(existing.perMinute, ONE_MINUTE_MS, now) : []
  const dayPruned = existing ? pruneTimestamps(existing.perDay, ONE_DAY_MS, now) : []

  rateLimitState.set(callerKey, {
    perMinute: [...minutePruned, now],
    perDay: [...dayPruned, now],
  })
}


export const applyRateLimitHeaders = (
  c: Readonly<Context>,
  headers: Readonly<Record<string, string>>
): void => {
  Object.entries(headers).forEach(([name, value]) => c.header(name, value))
}


const JSONRPC_NULL_ID = JSON.parse('null') as any

export const buildRateLimitExceededResponse = (
  c: Readonly<Context>,
  responseId: number | string | null,
  result: Readonly<McpRateLimitResult>
): Response => {
  return c.json(
    {
      jsonrpc: '2.0',
      id: responseId ?? JSONRPC_NULL_ID,
      error: {
        code: -32_603,
        message: 'Rate limit exceeded',
      },
    },
    429,
    {
      ...result.headers,
      'Retry-After': String(result.retryAfterSec),
    }
  )
}
