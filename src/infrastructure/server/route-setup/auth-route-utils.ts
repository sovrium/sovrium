/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createSlidingWindowLimiter } from '@/infrastructure/utils/sliding-window-limiter'
import type { SlidingWindowConfig } from '@/infrastructure/utils/sliding-window-limiter'


const getRateLimitWindowMs = (): number => {
  const windowSeconds = process.env.RATE_LIMIT_WINDOW_SECONDS
  return windowSeconds ? parseInt(windowSeconds, 10) * 1000 : 60 * 1000
}

export const extractClientIp = (forwardedFor: string | undefined): string => {
  return forwardedFor ? (forwardedFor.split(',')[0]?.trim() ?? '127.0.0.1') : '127.0.0.1'
}

interface EndpointRateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
}


const ADMIN_CONFIG: SlidingWindowConfig = { windowMs: 1000, maxRequests: 10 }
const adminLimiter = createSlidingWindowLimiter()

export const isRateLimitExceeded = (ip: string): boolean =>
  adminLimiter.isExceeded(ip, ADMIN_CONFIG)

export const recordRateLimitRequest = (ip: string): readonly number[] =>
  adminLimiter.record(ip, ADMIN_CONFIG)


const authLimiter = createSlidingWindowLimiter()

const getAuthRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    '/api/auth/sign-in/email': {
      windowMs,
      maxRequests: 20,
    },
    '/api/auth/sign-up/email': {
      windowMs,
      maxRequests: 20,
    },
    '/api/auth/request-password-reset': {
      windowMs,
      maxRequests: 10,
    },
  }
}

const getAuthRateLimitKey = (endpoint: string, ip: string): string => `${endpoint}:${ip}`

export const isAuthRateLimitExceeded = (endpoint: string, ip: string): boolean => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return false
  return authLimiter.isExceeded(getAuthRateLimitKey(endpoint, ip), config)
}

export const recordAuthRateLimitRequest = (endpoint: string, ip: string): readonly number[] => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return []
  return authLimiter.record(getAuthRateLimitKey(endpoint, ip), config)
}

export const getAuthRateLimitRetryAfter = (endpoint: string, ip: string): number => {
  const config = getAuthRateLimitConfigs()[endpoint]
  if (!config) return 0
  return authLimiter.getRetryAfter(getAuthRateLimitKey(endpoint, ip), config.windowMs)
}


const tablesLimiter = createSlidingWindowLimiter()

const getTablesRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    'GET:/api/tables': { windowMs, maxRequests: 100 },
    'GET:/api/tables/*': { windowMs, maxRequests: 100 },
    'POST:/api/tables/*': { windowMs, maxRequests: 50 },
  }
}

const resolveTablesConfigKey = (method: string, path: string): string => {
  const exactKey = `${method}:${path}`
  return getTablesRateLimitConfigs()[exactKey] ? exactKey : `${method}:/api/tables/*`
}

const getTablesRateLimitKey = (method: string, path: string, ip: string): string =>
  `${resolveTablesConfigKey(method, path)}:${ip}`

export const isTablesRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const config = getTablesRateLimitConfigs()[resolveTablesConfigKey(method, path)]
  if (!config) return false
  return tablesLimiter.isExceeded(getTablesRateLimitKey(method, path, ip), config)
}

export const recordTablesRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const config = getTablesRateLimitConfigs()[resolveTablesConfigKey(method, path)]
  if (!config) return []
  return tablesLimiter.record(getTablesRateLimitKey(method, path, ip), config)
}

export const getTablesRateLimitRetryAfter = (method: string, path: string, ip: string): number =>
  tablesLimiter.getRetryAfter(getTablesRateLimitKey(method, path, ip), getRateLimitWindowMs())


const activityLimiter = createSlidingWindowLimiter()

const getActivityRateLimitConfigs = (): Record<string, EndpointRateLimitConfig> => {
  const windowMs = getRateLimitWindowMs()
  return {
    'GET:/api/activity': { windowMs, maxRequests: 60 },
    'GET:/api/activity/*': { windowMs, maxRequests: 60 },
  }
}

const resolveActivityConfigKey = (method: string, path: string): string => {
  const exactKey = `${method}:${path}`
  return getActivityRateLimitConfigs()[exactKey] ? exactKey : `${method}:/api/activity/*`
}

const getActivityRateLimitKey = (method: string, path: string, ip: string): string =>
  `${resolveActivityConfigKey(method, path)}:${ip}`

export const isActivityRateLimitExceeded = (method: string, path: string, ip: string): boolean => {
  const config = getActivityRateLimitConfigs()[resolveActivityConfigKey(method, path)]
  if (!config) return false
  return activityLimiter.isExceeded(getActivityRateLimitKey(method, path, ip), config)
}

export const recordActivityRateLimitRequest = (
  method: string,
  path: string,
  ip: string
): readonly number[] => {
  const config = getActivityRateLimitConfigs()[resolveActivityConfigKey(method, path)]
  if (!config) return []
  return activityLimiter.record(getActivityRateLimitKey(method, path, ip), config)
}

export const getActivityRateLimitRetryAfter = (method: string, path: string, ip: string): number =>
  activityLimiter.getRetryAfter(getActivityRateLimitKey(method, path, ip), getRateLimitWindowMs())
