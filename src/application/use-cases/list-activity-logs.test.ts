/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ActivityLogRepository } from '@/application/ports/repositories/activity-log-repository'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'
import {
  ListActivityLogs,
  ActivityLogForbiddenError,
  type ListActivityLogsInput,
  type ActivityLogOutput,
} from './list-activity-logs'

/**
 * Unit tests for list-activity-logs use case
 *
 * Tests the application layer logic for listing activity logs.
 * Uses mock services to test use case logic without database dependencies.
 */

/**
 * Mock ActivityLogRepository for testing
 * Returns mock activity logs
 */
const mockLogs = [
  {
    id: 'log-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    userId: 'user-456',
    sessionId: null,
    action: 'create' as const,
    tableName: 'tasks',
    tableId: '1',
    recordId: 'record-1',
    changes: null,
    ipAddress: null,
    userAgent: null,
  },
  {
    id: 'log-2',
    createdAt: new Date('2025-01-02T00:00:00Z'),
    userId: 'user-456',
    sessionId: null,
    action: 'update' as const,
    tableName: 'tasks',
    tableId: '1',
    recordId: 'record-2',
    changes: null,
    ipAddress: null,
    userAgent: null,
  },
]

const MockActivityLogRepositoryLive = Layer.succeed(ActivityLogRepository, {
  listAll: () => Effect.succeed(mockLogs),
  create: () =>
    Effect.succeed({
      id: 'log-1',
      createdAt: new Date(),
      userId: 'user-123',
      sessionId: null,
      action: 'create' as const,
      tableName: 'users',
      tableId: '1',
      recordId: '1',
      changes: null,
      ipAddress: null,
      userAgent: null,
    }),
})

/**
 * Mock UserRoleRepository that returns admin role
 */
const MockAuthRepositoryAdmin = Layer.succeed(AuthRepository, {
  verifyUserEmail: () => Effect.void,
  getUserRole: () => Effect.succeed('admin'),
})

/**
 * Mock UserRoleRepository that returns member role
 */
const MockAuthRepositoryMember = Layer.succeed(AuthRepository, {
  verifyUserEmail: () => Effect.void,
  getUserRole: () => Effect.succeed('member'),
})

/**
 * Mock UserRoleRepository that returns viewer role
 */
const MockAuthRepositoryViewer = Layer.succeed(AuthRepository, {
  verifyUserEmail: () => Effect.void,
  getUserRole: () => Effect.succeed('viewer'),
})

/**
 * Mock UserRoleRepository that returns no role (undefined)
 *
 * NOTE: Effect.succeed(undefined) is CORRECT - return type is `Effect<string | undefined, E>`
 * We're returning `undefined` as a valid value (user has no role).
 * Effect.void would return `Effect<void, E>` which breaks the type contract.
 * The effectSucceedWithVoid diagnostic is a false positive when undefined is an intentional value.
 */
const MockAuthRepositoryNoRole = Layer.succeed(AuthRepository, {
  verifyUserEmail: () => Effect.void,
  // @effect-diagnostics effect/effectSucceedWithVoid:off
  getUserRole: () => Effect.succeed(undefined),
})

/**
 * Mock ActivityLogRepository that returns empty array
 */
const MockActivityLogRepositoryEmpty = Layer.succeed(ActivityLogRepository, {
  listAll: () => Effect.succeed([]),
  create: () =>
    Effect.succeed({
      id: 'log-1',
      createdAt: new Date(),
      userId: 'user-123',
      sessionId: null,
      action: 'create' as const,
      tableName: 'users',
      tableId: '1',
      recordId: '1',
      changes: null,
      ipAddress: null,
      userAgent: null,
    }),
})

describe('ListActivityLogs', () => {
  /**
   * Test input type validation
   *
   * Verifies that ListActivityLogsInput type enforces required fields.
   */
  test('should have correct input type structure', () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    expect(input.userId).toBe('user-456')
  })

  /**
   * Test Effect return type
   *
   * Verifies that ListActivityLogs returns an Effect that can be composed.
   */
  test('should return an Effect', () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input)

    // Verify it's an Effect (has pipe method)
    expect(typeof program.pipe).toBe('function')
  })

  /**
   * Test successful listing for admin user
   *
   * Verifies that admin users can access activity logs.
   */
  test('should successfully list logs for admin user', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryAdmin))
    )
    const result = await Effect.runPromise(program)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0]!.id).toBe('log-1')
    expect(result[0]!.action).toBe('create')
    expect(result[1]!.id).toBe('log-2')
    expect(result[1]!.action).toBe('update')
  })

  /**
   * Test successful listing for member user
   *
   * Verifies that member users can access activity logs.
   */
  test('should successfully list logs for member user', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryMember))
    )
    const result = await Effect.runPromise(program)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
  })

  /**
   * Test viewer role is denied access
   *
   * Verifies that viewer users receive ActivityLogForbiddenError.
   */
  test('should deny access for viewer user', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryViewer)),
      Effect.either
    )
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ActivityLogForbiddenError)
      expect(result.left.message).toContain('permission')
    }
  })

  /**
   * Test user with no role is denied access
   *
   * Verifies that users without a role receive ActivityLogForbiddenError.
   */
  test('should deny access for user with no role', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryNoRole)),
      Effect.either
    )
    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ActivityLogForbiddenError)
      expect(result.left.message).toContain('permission')
    }
  })

  /**
   * Test empty activity logs return empty array
   *
   * Verifies that users with proper permissions get empty array when no logs exist.
   */
  test('should return empty array when no logs exist', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryEmpty, MockAuthRepositoryAdmin))
    )
    const result = await Effect.runPromise(program)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  /**
   * Test activity log output type structure
   *
   * Verifies that ActivityLogOutput has correct shape and types.
   */
  test('should map to correct output type structure', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryAdmin))
    )
    const result = await Effect.runPromise(program)

    const log = result[0]!
    expect(log).toHaveProperty('id')
    expect(log).toHaveProperty('createdAt')
    expect(log).toHaveProperty('userId')
    expect(log).toHaveProperty('action')
    expect(log).toHaveProperty('tableName')
    expect(log).toHaveProperty('recordId')

    // Verify types
    expect(typeof log.id).toBe('string')
    expect(typeof log.createdAt).toBe('string') // ISO string
    expect(['create', 'update', 'delete', 'restore']).toContain(log.action)
  })

  /**
   * Test date formatting
   *
   * Verifies that createdAt is properly formatted as ISO string.
   */
  test('should format dates as ISO strings', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(
      Effect.provide(Layer.mergeAll(MockActivityLogRepositoryLive, MockAuthRepositoryAdmin))
    )
    const result = await Effect.runPromise(program)

    const log = result[0]!
    expect(log.createdAt).toBe('2025-01-01T00:00:00.000Z')
  })

  /**
   * Test that Effect can be converted to Either
   *
   * Verifies that errors can be handled functionally.
   */
  test('should allow error handling via Either', async () => {
    const input: ListActivityLogsInput = {
      userId: 'user-456',
    }

    const program = ListActivityLogs(input).pipe(Effect.either)

    // Verify Effect.either returns an Effect
    expect(typeof program.pipe).toBe('function')
  })

  /**
   * Test ActivityLogForbiddenError structure
   *
   * Verifies that ActivityLogForbiddenError has correct tag and message.
   */
  test('should define correct ActivityLogForbiddenError structure', () => {
    const error = new ActivityLogForbiddenError({
      message: 'You do not have permission to access activity logs',
    })

    expect(error._tag).toBe('ActivityLogForbiddenError')
    expect(error.message).toContain('permission')
  })
})

/**
 * Type-level tests (compile-time verification)
 *
 * These imports verify that the types are exported correctly
 * and can be used by other modules.
 */
describe('ListActivityLogs - type exports', () => {
  test('should export ListActivityLogsInput type', () => {
    // Type-level check - this test exists to ensure the type is exported
    type HasUserId = ListActivityLogsInput extends { userId: string } ? true : false
    const check: HasUserId = true
    expect(check).toBe(true)
  })

  test('should export ActivityLogOutput type', () => {
    // Type-level check - this test exists to ensure the type is exported
    type HasId = ActivityLogOutput extends { id: string } ? true : false
    const check: HasId = true
    expect(check).toBe(true)
  })

  test('should export ActivityLogForbiddenError type', () => {
    // Type-level check - this test exists to ensure the type is exported
    const error = new ActivityLogForbiddenError({ message: 'test' })
    expect(error._tag).toBe('ActivityLogForbiddenError')
  })
})
