/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  ActivityLogService,
  ActivityLogDatabaseError,
  type ActivityLogWithUser,
} from '@/infrastructure/services/activity-log-service'
import { GetRecordHistory } from './get-record-history'

/**
 * Mock ActivityLogService
 */
const mockLogs: readonly ActivityLogWithUser[] = [
  {
    id: 'log-1',
    action: 'create',
    changes: { after: { name: 'Task 1' } },
    createdAt: new Date('2025-01-01'),
    userId: 'user-1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    userImage: undefined,
  },
  {
    id: 'log-2',
    action: 'update',
    changes: { before: { name: 'Task 1' }, after: { name: 'Task 1 Updated' } },
    createdAt: new Date('2025-01-02'),
    userId: 'user-2',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    userImage: 'https://example.com/avatar.jpg',
  },
]

const MockActivityLogServiceLive = Layer.succeed(ActivityLogService, {
  listAll: () => Effect.fail(new ActivityLogDatabaseError({ cause: new Error('Not implemented') })),
  getRecordHistory: () =>
    Effect.succeed({
      logs: mockLogs,
      total: 2,
    }),
  create: () => Effect.fail(new ActivityLogDatabaseError({ cause: new Error('Not implemented') })),
})

describe('GetRecordHistory', () => {
  test('should return chronological change history with user metadata', async () => {
    const program = GetRecordHistory({
      tableName: 'tasks',
      recordId: 'record-1',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.history).toHaveLength(2)
    expect(result.history[0]?.id).toBe('log-1')
    expect(result.history[0]?.action).toBe('create')
    expect(result.history[0]?.user?.name).toBe('John Doe')
    expect(result.history[1]?.id).toBe('log-2')
    expect(result.history[1]?.action).toBe('update')
    expect(result.history[1]?.user?.name).toBe('Jane Smith')
    expect(result.history[1]?.user?.image).toBe('https://example.com/avatar.jpg')
  })

  test('should include pagination metadata when limit is provided', async () => {
    const program = GetRecordHistory({
      tableName: 'tasks',
      recordId: 'record-1',
      limit: 10,
      offset: 0,
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.pagination).toBeDefined()
    expect(result.pagination?.limit).toBe(10)
    expect(result.pagination?.offset).toBe(0)
    expect(result.pagination?.total).toBe(2)
  })

  test('should not include pagination when limit is undefined', async () => {
    const program = GetRecordHistory({
      tableName: 'tasks',
      recordId: 'record-1',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.pagination).toBeUndefined()
  })

  test('should format dates as ISO strings', async () => {
    const program = GetRecordHistory({
      tableName: 'tasks',
      recordId: 'record-1',
    }).pipe(Effect.provide(MockActivityLogServiceLive))

    const result = await Effect.runPromise(program)

    expect(result.history[0]?.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(result.history[1]?.createdAt).toBe('2025-01-02T00:00:00.000Z')
  })
})
