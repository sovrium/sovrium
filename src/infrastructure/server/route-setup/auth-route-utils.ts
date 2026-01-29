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
 * Get rate limit window duration in milliseconds from environment variable
 * Defaults to 60 seconds (production) if not set
 * Tests should set RATE_LIMIT_WINDOW_SECONDS=5 for faster execution
 */
const getRateLimitWindowMs = (): number => {
  const windowSeconds = process.env.RATE_LIMIT_WINDOW_SECONDS
  return windowSeconds ? parseInt(windowSeconds, 10) * 1000 : 60 * 1000
}

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

/**
 * Get authentication rate limit configurations
 * Uses configurable window from environment variable
 */
const getAuthRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()

  return {
    '/api/auth/sign-in/email': {
      windowMs,
      maxRequests: 20, // 20 attempts per window (prevents brute force while allowing legitimate retries)
    },
    '/api/auth/sign-up/email': {
      windowMs,
      maxRequests: 20, // 20 signups per window (prevents abuse while allowing test scenarios)
    },
    '/api/auth/request-password-reset': {
      windowMs,
      maxRequests: 10, // 10 attempts per window (prevents enumeration while allowing legitimate use)
    },
  }
}

const AUTH_RATE_LIMIT_CONFIGS: Record<string, EndpointRateLimitConfig> = getAuthRateLimitConfigs()

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

/**
 * Calculate seconds until auth rate limit window resets
 */
export const getAuthRateLimitRetryAfter = (endpoint: string, ip: string): number => {
  const config = AUTH_RATE_LIMIT_CONFIGS[endpoint]
  if (!config) return 0

  const recentRequests = getAuthRecentRequests(endpoint, ip)
  if (recentRequests.length === 0) return 0

  const oldestRequest = Math.min(...recentRequests)
  const resetTime = oldestRequest + config.windowMs
  const now = Date.now()
  const retryAfterMs = Math.max(0, resetTime - now)

  return Math.ceil(retryAfterMs / 1000) // Convert to seconds
}

/**
 * Rate limiting configuration for table API endpoints
 * Higher limits than auth endpoints since legitimate usage involves frequent data operations
 */
const getTablesRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()

  return {
    // List tables endpoint
    'GET:/api/tables': {
      windowMs,
      maxRequests: 100, // 100 requests per window (frequent polling for table lists)
    },
    // Get table records endpoint (read operations)
    'GET:/api/tables/*': {
      windowMs,
      maxRequests: 100, // 100 requests per window (frequent data fetching)
    },
    // Create record endpoint (write operations - stricter limits)
    'POST:/api/tables/*': {
      windowMs,
      maxRequests: 50, // 50 requests per window (prevent data flooding)
    },
  }
}

const TABLES_RATE_LIMIT_CONFIGS: Record<string, EndpointRateLimitConfig> =
  getTablesRateLimitConfigs()

/**
 * Rate limiting state for table endpoints
 * Maps method:endpoint + IP to request timestamps
 */
const tablesRateLimitState = new Map<string, number[]>()

/**
 * Get rate limit key for table endpoint (includes HTTP method)
 */
const getTablesRateLimitKey = (method: string, path: string, ip: string): string => {
  // Match exact path or wildcard pattern
  const configKey = TABLES_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/tables/*`

  return `${configKey}:${ip}`
}

/**
 * Get recent requests for table endpoint
 */
export const getTablesRecentRequests = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const configKey = TABLES_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/tables/*`

  const config = TABLES_RATE_LIMIT_CONFIGS[configKey]
  if (!config) return []

  const now = Date.now()
  const key = getTablesRateLimitKey(method, path, ip)
  const requestHistory = tablesRateLimitState.get(key) ?? []
  return requestHistory.filter((timestamp) => now - timestamp < config.windowMs)
}

/**
 * Check if table endpoint rate limit is exceeded
 */
export const isTablesRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const configKey = TABLES_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/tables/*`

  const config = TABLES_RATE_LIMIT_CONFIGS[configKey]
  if (!config) return false

  return getTablesRecentRequests(method, path, ip).length >= config.maxRequests
}

/**
 * Record a request for table endpoint rate limiting
 */
export const recordTablesRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const recentRequests = getTablesRecentRequests(method, path, ip)
  const now = Date.now()
  const key = getTablesRateLimitKey(method, path, ip)
  const updated = [...recentRequests, now]
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
  tablesRateLimitState.set(key, updated)
  return updated
}

/**
 * Calculate seconds until rate limit window resets
 */
export const getTablesRateLimitRetryAfter = (method: string, path: string, ip: string): number => {
  const recentRequests = getTablesRecentRequests(method, path, ip)
  if (recentRequests.length === 0) return 0

  const windowMs = getRateLimitWindowMs()
  const oldestRequest = Math.min(...recentRequests)
  const resetTime = oldestRequest + windowMs
  const now = Date.now()
  const retryAfterMs = Math.max(0, resetTime - now)

  return Math.ceil(retryAfterMs / 1000) // Convert to seconds
}

/**
 * Rate limiting configuration for activity API endpoints
 * Moderate limits since activity logs can be polled frequently for real-time updates
 */
const getActivityRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()

  return {
    // List activity endpoint
    'GET:/api/activity': {
      windowMs,
      maxRequests: 60, // 60 requests per window (polling for activity updates)
    },
    // Get activity detail endpoint
    'GET:/api/activity/*': {
      windowMs,
      maxRequests: 60, // 60 requests per window (activity log detail fetching)
    },
  }
}

const ACTIVITY_RATE_LIMIT_CONFIGS: Record<string, EndpointRateLimitConfig> =
  getActivityRateLimitConfigs()

/**
 * Rate limiting state for activity endpoints
 * Maps method:endpoint + IP to request timestamps
 */
const activityRateLimitState = new Map<string, number[]>()

/**
 * Get rate limit key for activity endpoint (includes HTTP method)
 */
const getActivityRateLimitKey = (method: string, path: string, ip: string): string => {
  const configKey = ACTIVITY_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/activity/*`

  return `${configKey}:${ip}`
}

/**
 * Get recent requests for activity endpoint
 */
export const getActivityRecentRequests = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const configKey = ACTIVITY_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/activity/*`

  const config = ACTIVITY_RATE_LIMIT_CONFIGS[configKey]
  if (!config) return []

  const now = Date.now()
  const key = getActivityRateLimitKey(method, path, ip)
  const requestHistory = activityRateLimitState.get(key) ?? []
  return requestHistory.filter((timestamp) => now - timestamp < config.windowMs)
}

/**
 * Check if activity endpoint rate limit is exceeded
 */
export const isActivityRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const configKey = ACTIVITY_RATE_LIMIT_CONFIGS[`${method}:${path}`]
    ? `${method}:${path}`
    : `${method}:/api/activity/*`

  const config = ACTIVITY_RATE_LIMIT_CONFIGS[configKey]
  if (!config) return false

  return getActivityRecentRequests(method, path, ip).length >= config.maxRequests
}

/**
 * Record a request for activity endpoint rate limiting
 */
export const recordActivityRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const recentRequests = getActivityRecentRequests(method, path, ip)
  const now = Date.now()
  const key = getActivityRateLimitKey(method, path, ip)
  const updated = [...recentRequests, now]
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- Rate limiting requires mutable state
  activityRateLimitState.set(key, updated)
  return updated
}

/**
 * Calculate seconds until activity rate limit window resets
 */
export const getActivityRateLimitRetryAfter = (
  method: string,
  path: string,
  ip: string
): number => {
  const recentRequests = getActivityRecentRequests(method, path, ip)
  if (recentRequests.length === 0) return 0

  const windowMs = getRateLimitWindowMs()
  const oldestRequest = Math.min(...recentRequests)
  const resetTime = oldestRequest + windowMs
  const now = Date.now()
  const retryAfterMs = Math.max(0, resetTime - now)

  return Math.ceil(retryAfterMs / 1000) // Convert to seconds
}
