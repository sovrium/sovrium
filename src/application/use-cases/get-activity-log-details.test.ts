/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  ActivityLogService,
  ActivityLogNotFoundError as ServiceActivityLogNotFoundError,
} from '@/infrastructure/services/activity-log-service'
import {
  GetActivityLogDetails,
  InvalidActivityIdError,
  ActivityLogNotFoundError,
} from './get-activity-log-details'

/**
 * Mock ActivityLogService that returns a valid activity log
 */
const MockActivityLogServiceLive = Layer.succeed(ActivityLogService, {
  listAll: () =>
    Effect.succeed([
      {
        id: 'log-1',
        createdAt: new Date('2025-02-05T10:00:00Z'),
        userId: 'user-123',
        sessionId: null,
        action: 'create' as const,
        tableName: 'tasks',
        tableId: '1',
        recordId: '42',
        changes: { before: undefined, after: { title: 'Test Task' } },
        ipAddress: null,
        userAgent: null,
      },
    ]),
  findById: () =>
    Effect.succeed({
      id: 'log-1',
      createdAt: new Date('2025-02-05T10:00:00Z'),
      userId: 'user-123',
      sessionId: null,
      action: 'create' as const,
      tableName: 'tasks',
      tableId: '1',
      recordId: '42',
      changes: { before: undefined, after: { title: 'Test Task' } },
      ipAddress: null,
      userAgent: null,
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      },
    }),
  create: () =>
    Effect.succeed({
      id: 'log-1',
      createdAt: new Date(),
      userId: 'user-123',
      sessionId: null,
      action: 'create' as const,
      tableName: 'tasks',
      tableId: '1',
      recordId: '42',
      changes: null,
      ipAddress: null,
      userAgent: null,
    }),
})

/**
 * Mock ActivityLogService that returns not found error
 */
const MockActivityLogServiceNotFound = Layer.succeed(ActivityLogService, {
  listAll: () => Effect.succeed([]),
  findById: () => Effect.fail(new ServiceActivityLogNotFoundError({ activityId: 'log-999' })),
  create: () =>
    Effect.succeed({
      id: 'log-1',
      createdAt: new Date(),
      userId: 'user-123',
      sessionId: null,
      action: 'create' as const,
      tableName: 'tasks',
      tableId: '1',
      recordId: '42',
      changes: null,
      ipAddress: null,
      userAgent: null,
    }),
})

describe('GetActivityLogDetails', () => {
  test('should return activity log details with user metadata', async () => {
    const program = GetActivityLogDetails({
      activityId: 'log-1',
      userId: 'user-123',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(result.right).toEqual({
        id: 'log-1',
        userId: 'user-123',
        action: 'create',
        tableName: 'tasks',
        recordId: 42,
        changes: { before: undefined, after: { title: 'Test Task' } },
        createdAt: '2025-02-05T10:00:00.000Z',
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      })
    }
  })

  test('should fail with InvalidActivityIdError when activity ID is empty', async () => {
    const program = GetActivityLogDetails({
      activityId: '',
      userId: 'user-123',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
      if (result.left instanceof InvalidActivityIdError) {
        expect(result.left.activityId).toBe('')
        expect(result.left.message).toBe('Activity ID cannot be empty')
      }
    }
  })

  test('should fail with ActivityLogNotFoundError when activity log does not exist', async () => {
    const program = GetActivityLogDetails({
      activityId: 'log-999',
      userId: 'user-123',
    }).pipe(Effect.provide(MockActivityLogServiceNotFound))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ActivityLogNotFoundError)
      if (result.left instanceof ActivityLogNotFoundError) {
        expect(result.left.activityId).toBe('log-999')
      }
    }
  })

  test('should parse recordId as integer from string', async () => {
    const program = GetActivityLogDetails({
      activityId: 'log-1',
      userId: 'user-123',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(typeof result.right.recordId).toBe('number')
      expect(result.right.recordId).toBe(42)
    }
  })

  test('should convert createdAt Date to ISO string', async () => {
    const program = GetActivityLogDetails({
      activityId: 'log-1',
      userId: 'user-123',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(typeof result.right.createdAt).toBe('string')
      expect(result.right.createdAt).toBe('2025-02-05T10:00:00.000Z')
    }
  })
})
