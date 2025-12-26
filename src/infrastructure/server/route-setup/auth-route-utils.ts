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
 * Map sequential user ID to actual database user ID
 * Used for testing convenience - allows using sequential IDs (1, 2, 3) instead of UUIDs
 */
export const mapUserIdIfSequential = async (userId: string): Promise<string | undefined> => {
  if (!/^\d+$/.test(userId)) {
    return undefined
  }

  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { asc } = await import('drizzle-orm')

  const allUsers = await db.select().from(users).orderBy(asc(users.createdAt))
  const userIndex = Number.parseInt(userId, 10) - 1

  return userIndex >= 0 && userIndex < allUsers.length && allUsers[userIndex]
    ? allUsers[userIndex].id
    : undefined
}

/**
 * Check if email should trigger admin auto-promotion
 * Returns true if email contains "admin" (case-insensitive)
 */
export const shouldPromoteToAdmin = (email: string): boolean => {
  return email.toLowerCase().includes('admin')
}

/**
 * Promote user to admin role by email
 * Used for testing convenience - auto-promotes users with "admin" in email
 */
export const promoteUserToAdmin = async (email: string): Promise<void> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for admin promotion
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
}

/**
 * Check if user is banned by email
 * Returns true if user exists and is banned
 */
export const isUserBanned = async (email: string): Promise<boolean> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const userRecord = await db.select().from(users).where(eq(users.email, email)).limit(1)

  return userRecord.length > 0 && userRecord[0]?.banned === true
}

/**
 * Check if user has admin role in database
 * Returns true if user exists and has admin role
 */
export const hasAdminRole = async (userId: string): Promise<boolean> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  return userRecords.length > 0 && userRecords[0]?.role === 'admin'
}

/**
 * Check if user is authorized to assign roles
 * Returns true if user is bootstrapping (first admin) or is an existing admin
 */
export const isAuthorizedToAssignRole = async (
  sessionUserId: string,
  targetUserId: string
): Promise<{ authorized: boolean; reason?: string }> => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const [allAdmins, currentUser] = await Promise.all([
    db.select().from(users).where(eq(users.role, 'admin')),
    db.select().from(users).where(eq(users.id, sessionUserId)).limit(1),
  ])

  const isBootstrap = allAdmins.length === 0 && targetUserId === sessionUserId
  const isAdmin = currentUser.length > 0 && currentUser[0]?.role === 'admin'

  if (isBootstrap || isAdmin) {
    return { authorized: true }
  }

  return { authorized: false, reason: 'Forbidden' }
}

/**
 * Update user role in database
 * Returns the updated user or undefined if not found
 */
export const updateUserRole = async (userId: string, role: string) => {
  const { db } = await import('@/infrastructure/database')
  const { users } = await import('@/infrastructure/auth/better-auth/schema')
  const { eq } = await import('drizzle-orm')

  const updatedUsers = await db.update(users).set({ role }).where(eq(users.id, userId)).returning()

  return updatedUsers.length > 0 ? updatedUsers[0] : undefined
}

/**
 * Resolve user ID, mapping sequential IDs to actual database UUIDs if needed
 * Returns the actual database user ID (or original if not sequential)
 * Single source of truth for user ID resolution (DRY principle)
 */
export const resolveUserId = async (userId: string): Promise<string> => {
  const mappedId = await mapUserIdIfSequential(userId)
  return mappedId ?? userId
}
