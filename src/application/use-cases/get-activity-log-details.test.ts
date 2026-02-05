/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from 'bun:test'
import { Data, Effect } from 'effect'
import { ActivityLogService } from '@/infrastructure/services/activity-log-service'
import { GetActivityLogDetails, type InvalidActivityIdError } from './get-activity-log-details'

test('GetActivityLogDetails should reject invalid UUID format', async () => {
  class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
    readonly cause: unknown
  }> {}

  const mockService = ActivityLogService.of({
    listAll: () => Effect.succeed([]),
    findById: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
    create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
  })

  const program = GetActivityLogDetails({
    activityId: 'invalid-uuid',
  }).pipe(Effect.provideService(ActivityLogService, mockService), Effect.either)

  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe('InvalidActivityIdError')
    expect((result.left as InvalidActivityIdError).id).toBe('invalid-uuid')
  }
})

test('GetActivityLogDetails should reject invalid numeric ID', async () => {
  class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
    readonly cause: unknown
  }> {}

  const mockService = ActivityLogService.of({
    listAll: () => Effect.succeed([]),
    findById: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
    create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
  })

  const program = GetActivityLogDetails({
    activityId: 'not-a-number',
  }).pipe(Effect.provideService(ActivityLogService, mockService), Effect.either)

  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe('InvalidActivityIdError')
  }
})

test('GetActivityLogDetails should accept valid UUID', async () => {
  const validUUID = '123e4567-e89b-12d3-a456-426614174000'

  class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
    readonly cause: unknown
  }> {}

  const mockService = ActivityLogService.of({
    listAll: () => Effect.succeed([]),
    findById: (id: string) =>
      Effect.succeed({
        id,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        userId: 'user-123',
        sessionId: 'session-123',
        action: 'create' as const,
        tableName: 'test_table',
        tableId: 'table-123',
        recordId: '1',
        changes: { before: {}, after: {} },
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
      }),
    create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
  })

  const program = GetActivityLogDetails({
    activityId: validUUID,
  }).pipe(Effect.provideService(ActivityLogService, mockService), Effect.either)

  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.id).toBe(validUUID)
    expect(result.right.action).toBe('create')
    expect(result.right.tableName).toBe('test_table')
  }
})

test('GetActivityLogDetails should accept valid numeric ID', async () => {
  const validNumericId = '12345'

  class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
    readonly cause: unknown
  }> {}

  const mockService = ActivityLogService.of({
    listAll: () => Effect.succeed([]),
    findById: (id: string) =>
      Effect.succeed({
        id,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        userId: null,
        sessionId: null,
        action: 'update' as const,
        tableName: 'test_table',
        tableId: 'table-123',
        recordId: '1',
        changes: { before: { field: 'old' }, after: { field: 'new' } },
        ipAddress: null,
        userAgent: null,
        user: undefined,
      }),
    create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
  })

  const program = GetActivityLogDetails({
    activityId: validNumericId,
  }).pipe(Effect.provideService(ActivityLogService, mockService), Effect.either)

  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Right')
  if (result._tag === 'Right') {
    expect(result.right.id).toBe(validNumericId)
    expect(result.right.user).toBeNull()
  }
})

test('GetActivityLogDetails should propagate ActivityLogNotFoundError', async () => {
  class ActivityLogNotFoundError extends Data.TaggedError('ActivityLogNotFoundError')<{
    readonly id: string
  }> {}

  class ActivityLogDatabaseError extends Data.TaggedError('ActivityLogDatabaseError')<{
    readonly cause: unknown
  }> {}

  const mockService = ActivityLogService.of({
    listAll: () => Effect.succeed([]),
    findById: () => Effect.fail(new ActivityLogNotFoundError({ id: '123' })),
    create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'Should not be called' })),
  })

  const program = GetActivityLogDetails({
    activityId: '123',
  }).pipe(Effect.provideService(ActivityLogService, mockService), Effect.either)

  const result = await Effect.runPromise(program)

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left._tag).toBe('ActivityLogNotFoundError')
  }
})
