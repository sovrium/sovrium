/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data with sensible defaults.
 * These factories generate SQL statements that can be used with the
 * executeQuery fixture.
 *
 * Usage:
 * ```typescript
 * const { sql, user } = createUser({ email: 'test@example.com', role: 'admin' })
 * await executeQuery(sql)
 * // user object contains the generated data for assertions
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'user' | 'admin' | 'member'

export interface TestUser {
  id: number
  email: string
  name: string
  passwordHash: string
  emailVerified: boolean
  role: UserRole
  banned: boolean
  banReason: string | null
}

export interface TestSession {
  id: number
  userId: number
  token: string
  expiresAt: Date
}

// ============================================================================
// Counters for unique IDs
// ============================================================================

let userIdCounter = 1
let sessionIdCounter = 1

/**
 * Reset all ID counters
 * Call at the beginning of each test to ensure consistent IDs
 */
export function resetFactoryCounters(): void {
  userIdCounter = 1
  sessionIdCounter = 1
}

// ============================================================================
// User Factory
// ============================================================================

export interface CreateUserOptions {
  id?: number
  email?: string
  name?: string
  passwordHash?: string
  emailVerified?: boolean
  role?: UserRole
  banned?: boolean
  banReason?: string | null
}

/**
 * Create a test user with SQL and data
 */
export function createUser(options: CreateUserOptions = {}): {
  sql: string
  user: TestUser
} {
  const id = options.id ?? userIdCounter++
  const user: TestUser = {
    id,
    email: options.email ?? `user${id}@example.com`,
    name: options.name ?? `User ${id}`,
    passwordHash: options.passwordHash ?? '$2a$10$TestHashedPassword',
    emailVerified: options.emailVerified ?? true,
    role: options.role ?? 'user',
    banned: options.banned ?? false,
    banReason: options.banReason ?? null,
  }

  const sql = `INSERT INTO users (id, email, password_hash, name, email_verified, role, banned, ban_reason, created_at, updated_at)
    VALUES (${user.id}, '${user.email}', '${user.passwordHash}', '${user.name}', ${user.emailVerified}, '${user.role}', ${user.banned}, ${user.banReason ? `'${user.banReason}'` : 'NULL'}, NOW(), NOW())`

  return { sql, user }
}

/**
 * Create an admin user with session
 */
export function createAdmin(options: CreateUserOptions = {}): {
  sql: string[]
  user: TestUser
  session: TestSession
} {
  const { sql: userSql, user } = createUser({ ...options, role: 'admin' })
  const { sql: sessionSql, session } = createSession({ userId: user.id })

  return {
    sql: [userSql, sessionSql],
    user,
    session,
  }
}

// ============================================================================
// Session Factory
// ============================================================================

export interface CreateSessionOptions {
  id?: number
  userId: number
  token?: string
  expiresInDays?: number
  expired?: boolean
}

/**
 * Create a test session with SQL and data
 */
export function createSession(options: CreateSessionOptions): {
  sql: string
  session: TestSession
} {
  const id = options.id ?? sessionIdCounter++
  const expiresAt = new Date()

  if (options.expired) {
    expiresAt.setDate(expiresAt.getDate() - 1) // Expired yesterday
  } else {
    expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays ?? 7))
  }

  const session: TestSession = {
    id,
    userId: options.userId,
    token: options.token ?? `session_token_${id}`,
    expiresAt,
  }

  const sql = `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (${session.id}, ${session.userId}, '${session.token}', '${expiresAt.toISOString()}', NOW())`

  return { sql, session }
}

// ============================================================================
// Multi-User Scenario Helpers
// ============================================================================

export interface TwoUserScenario {
  sql: string[]
  user1: TestUser
  session1: TestSession
  user2: TestUser
  session2: TestSession
}

/**
 * Create a scenario with two users, each with their own session
 */
export function createTwoUserScenario(options?: {
  user1Options?: CreateUserOptions
  user2Options?: CreateUserOptions
}): TwoUserScenario {
  const { sql: user1Sql, user: user1 } = createUser(options?.user1Options)
  const { sql: session1Sql, session: session1 } = createSession({ userId: user1.id })

  const { sql: user2Sql, user: user2 } = createUser(options?.user2Options)
  const { sql: session2Sql, session: session2 } = createSession({ userId: user2.id })

  return {
    sql: [user1Sql, session1Sql, user2Sql, session2Sql],
    user1,
    session1,
    user2,
    session2,
  }
}

export interface AdminAndUserScenario {
  sql: string[]
  admin: TestUser
  adminSession: TestSession
  user: TestUser
  userSession: TestSession
}

/**
 * Create a scenario with an admin and a regular user
 */
export function createAdminAndUserScenario(): AdminAndUserScenario {
  const { sql: adminSql, user: admin, session: adminSession } = createAdmin()
  const { sql: userSql, user } = createUser()
  const { sql: sessionSql, session: userSession } = createSession({ userId: user.id })

  return {
    sql: [...adminSql, userSql, sessionSql],
    admin,
    adminSession,
    user,
    userSession,
  }
}
