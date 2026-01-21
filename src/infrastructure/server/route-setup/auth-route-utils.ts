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

/**
 * Rate limiting configuration for authentication endpoints
 * Security-critical endpoints to prevent brute force attacks
 */
interface EndpointRateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
}

const AUTH_RATE_LIMIT_CONFIGS: Record<string, EndpointRateLimitConfig> = {
  '/api/auth/sign-in/email': {
    windowMs: 60 * 1000, // 60 seconds
    maxRequests: 5, // 5 attempts per minute (prevent credential stuffing)
  },
  '/api/auth/sign-up/email': {
    windowMs: 60 * 1000, // 60 seconds
    maxRequests: 5, // 5 signups per minute (prevent account creation abuse)
  },
  '/api/auth/request-password-reset': {
    windowMs: 60 * 1000, // 60 seconds
    maxRequests: 3, // 3 attempts per minute (prevent email enumeration)
  },
}

/**
 * Rate limiting state for authentication endpoints
 * Maps endpoint + IP to request timestamps
 */
const authRateLimitState = new Map<string, number[]>()

/**
 * Get rate limit key for endpoint + IP combination
 */
const getRateLimitKey = (endpoint: string, ip: string): string => {
  return `${endpoint}:${ip}`
}

/**
 * Get recent requests within the rate limit window for an endpoint + IP
 */
export const getAuthRecentRequests = (endpoint: string, ip: string): readonly number[] => {
  const config = AUTH_RATE_LIMIT_CONFIGS[endpoint]
  if (!config) return []

  const now = Date.now()
  const key = getRateLimitKey(endpoint, ip)
  const requestHistory = authRateLimitState.get(key) ?? []
  return requestHistory.filter((timestamp) => now - timestamp < config.windowMs)
}

/**
 * Check if auth endpoint rate limit is exceeded for an IP
 */
export const isAuthRateLimitExceeded = (endpoint: string, ip: string): boolean => {
  const config = AUTH_RATE_LIMIT_CONFIGS[endpoint]
  if (!config) return false

  return getAuthRecentRequests(endpoint, ip).length >= config.maxRequests
}

/**
 * Record a request for auth endpoint rate limiting
 */
export const recordAuthRateLimitRequest = (endpoint: string, ip: string): readonly number[] => {
  const recentRequests = getAuthRecentRequests(endpoint, ip)
  const now = Date.now()
  const key = getRateLimitKey(endpoint, ip)
  const updated = [...recentRequests, now]
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
  authRateLimitState.set(key, updated)
  return updated
}
