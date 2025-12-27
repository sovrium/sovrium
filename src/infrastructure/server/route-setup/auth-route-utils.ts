/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rate limiting state for admin endpoints
 * Maps IP addresses to request timestamps
 * In production, this should use Redis or similar distributed storage
 */
const adminRateLimitState = new Map<string, number[]>()

/**
 * Rate limiting configuration constants
 */
const RATE_LIMIT_WINDOW_MS = 1000 // 1 second window
const RATE_LIMIT_MAX_REQUESTS = 10 // Maximum requests per window

/**
 * Get recent requests within the rate limit window for an IP address
 * Returns filtered array of timestamps within RATE_LIMIT_WINDOW_MS
 * Single source of truth for request filtering (DRY principle)
 */
export const getRecentRequests = (ip: string): readonly number[] => {
  const now = Date.now()
  const requestHistory = adminRateLimitState.get(ip) ?? []
  return requestHistory.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
}

/**
 * Check rate limit for an IP address
 * Returns true if rate limit is exceeded, false otherwise
 */
export const isRateLimitExceeded = (ip: string): boolean => {
  return getRecentRequests(ip).length >= RATE_LIMIT_MAX_REQUESTS
}

/**
 * Record a request for rate limiting
 * Updates the request history for the given IP address
 * Returns the updated request history for testing/debugging
 */
export const recordRateLimitRequest = (ip: string): readonly number[] => {
  const recentRequests = getRecentRequests(ip)
  const now = Date.now()
  const updated = [...recentRequests, now]
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
  adminRateLimitState.set(ip, updated)
  return updated
}

/**
 * Extract IP address from request headers
 * Returns the client IP from x-forwarded-for or defaults to localhost
 */
export const extractClientIp = (forwardedFor: string | undefined): string => {
  return forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'
}
