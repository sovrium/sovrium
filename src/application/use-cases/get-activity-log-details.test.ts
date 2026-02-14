/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  ActivityLogService,
  type ActivityLogWithUser,
  ActivityLogDatabaseError,
} from '@/infrastructure/services/activity-log-service'
import {
  GetActivityLogDetails,
  ActivityLogNotFoundError,
  InvalidActivityIdError,
} from './get-activity-log-details'

// Mock ActivityLogService implementation
const mockActivityLog: ActivityLogWithUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  createdAt: new Date('2025-02-14T12:00:00Z'),
  userId: 'user-123',
  sessionId: 'session-123',
  action: 'create',
  tableName: 'users',
  tableId: 'table-123',
  recordId: '42',
  changes: {
    before: {},
    after: { name: 'Alice', email: 'alice@example.com' },
  },
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  user: {
    id: 'user-123',
    name: 'Alice Smith',
    email: 'alice@example.com',
  },
}

const createMockActivityLogService = (
  getByIdFn: (id: string) => Effect.Effect<ActivityLogWithUser | null, ActivityLogDatabaseError>
) =>
  Layer.succeed(ActivityLogService, {
    listAll: () => Effect.succeed([]),
    getById: getByIdFn,
    create: () => Effect.succeed({} as any),
  })

describe('GetActivityLogDetails', () => {
  test('returns activity log details when found', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result).toMatchObject({
      id: mockActivityLog.id,
      createdAt: '2025-02-14T12:00:00.000Z',
      userId: 'user-123',
      action: 'create',
      tableName: 'users',
      recordId: 42,
      changes: {
        before: {},
        after: { name: 'Alice', email: 'alice@example.com' },
      },
      user: {
        id: 'user-123',
        name: 'Alice Smith',
        email: 'alice@example.com',
      },
    })
  })

  test('converts recordId from string to number', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(typeof result.recordId).toBe('number')
    expect(result.recordId).toBe(42)
  })

  test('formats createdAt as ISO string', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.createdAt).toBe('2025-02-14T12:00:00.000Z')
  })

  test('accepts UUID format activity IDs', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: '123e4567-e89b-12d3-a456-426614174000',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.id).toBe(mockActivityLog.id)
  })

  test('accepts numeric string activity IDs', async () => {
    const numericLog = { ...mockActivityLog, id: '12345' }
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(numericLog))

    const program = GetActivityLogDetails({
      activityId: '12345',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.id).toBe('12345')
  })

  test('trims whitespace from activity ID', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: '  123e4567-e89b-12d3-a456-426614174000  ',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.id).toBe(mockActivityLog.id)
  })

  test('returns ActivityLogNotFoundError when activity log not found', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(null))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ActivityLogNotFoundError)
      expect(result.left.message).toBe('Activity log not found')
    }
  })

  test('returns InvalidActivityIdError for empty string', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: '',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
      expect(result.left.message).toBe('Activity ID must be a valid UUID or numeric identifier')
    }
  })

  test('returns InvalidActivityIdError for whitespace-only string', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: '   ',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
    }
  })

  test('returns InvalidActivityIdError for invalid UUID format', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: 'not-a-valid-uuid',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
    }
  })

  test('returns InvalidActivityIdError for mixed alphanumeric strings', async () => {
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(mockActivityLog))

    const program = GetActivityLogDetails({
      activityId: 'abc123xyz',
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
    }
  })

  test('propagates ActivityLogDatabaseError from service', async () => {
    const MockServiceLayer = createMockActivityLogService(() =>
      Effect.fail(new ActivityLogDatabaseError({ cause: new Error('Database connection failed') }))
    )

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program.pipe(Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ActivityLogDatabaseError)
      expect(result.left.cause).toBeInstanceOf(Error)
    }
  })

  test('handles activity log with null user', async () => {
    const logWithoutUser = { ...mockActivityLog, user: null, userId: null }
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(logWithoutUser))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.user).toBeNull()
    expect(result.userId).toBeUndefined()
  })

  test('handles activity log with null changes', async () => {
    const logWithoutChanges = { ...mockActivityLog, changes: null }
    const MockServiceLayer = createMockActivityLogService(() => Effect.succeed(logWithoutChanges))

    const program = GetActivityLogDetails({
      activityId: mockActivityLog.id,
    }).pipe(Effect.provide(MockServiceLayer))

    const result = await Effect.runPromise(program)

    expect(result.changes).toBeNull()
  })
})
