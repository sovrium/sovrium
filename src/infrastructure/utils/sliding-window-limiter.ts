/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SlidingWindowConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

export interface SlidingWindowLimiter {
  readonly getRecent: (key: string, windowMs: number) => readonly number[]
  readonly isExceeded: (key: string, config: SlidingWindowConfig) => boolean
  readonly record: (key: string, config: SlidingWindowConfig) => readonly number[]
  readonly getRetryAfter: (key: string, windowMs: number) => number
}

export const createSlidingWindowLimiter = (): SlidingWindowLimiter => {
  const state = new Map<string, number[]>()

  const getRecent = (key: string, windowMs: number): readonly number[] => {
    const now = Date.now()
    const history = state.get(key) ?? []
    return history.filter((timestamp) => now - timestamp < windowMs)
  }

  return {
    getRecent,
    isExceeded: (key, config) => getRecent(key, config.windowMs).length >= config.maxRequests,
    record: (key, config) => {
      const recent = getRecent(key, config.windowMs)
      const updated = [...recent, Date.now()]
      state.set(key, updated)
      return updated
    },
    getRetryAfter: (key, windowMs) => {
      const recent = getRecent(key, windowMs)
      if (recent.length === 0) return 0
      const oldestRequest = Math.min(...recent)
      const resetTime = oldestRequest + windowMs
      const now = Date.now()
      const retryAfterMs = Math.max(0, resetTime - now)
      return Math.ceil(retryAfterMs / 1000)
    },
  }
}
