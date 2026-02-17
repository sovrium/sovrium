/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ActivityRepository } from './activity-repository'
import type { ActivityHistoryEntry } from './activity-repository'
import type { UserSession } from '@/application/ports/models/user-session'

describe('ActivityRepository', () => {
  test('should be a Context.Tag', () => {
    expect(ActivityRepository.key).toBe('ActivityRepository')
  })

  test('should define getRecordHistory method signature', async () => {
    // Create a test implementation
    const mockHistory: readonly ActivityHistoryEntry[] = [
      {
        action: 'create',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        changes: { name: 'Test' },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
        },
      },
    ]

    const mockSession: UserSession = {
      id: 'session-1',
      userId: 'user-1',
      token: 'test-token',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      impersonatedBy: null,
    }

    const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
      getRecordHistory: () => Effect.succeed({ entries: mockHistory, total: mockHistory.length }),
      checkRecordExists: () => Effect.succeed(true),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityRepository
      const result = yield* repo.getRecordHistory({
        session: mockSession,
        tableName: 'users',
        recordId: 'record-1',
      })
      return result
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestActivityRepositoryLive)))

    expect(result.entries).toEqual(mockHistory)
    expect(result.entries[0]?.action).toBe('create')
    expect(result.entries[0]?.user?.name).toBe('Test User')
    expect(result.total).toBe(1)
  })

  test('should handle multiple history entries', async () => {
    const mockHistory: readonly ActivityHistoryEntry[] = [
      {
        action: 'create',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        changes: { name: 'Test' },
        user: {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
        },
      },
      {
        action: 'update',
        createdAt: new Date('2025-01-02T00:00:00Z'),
        changes: { name: 'Updated Test' },
        user: {
          id: 'user-2',
          name: 'Another User',
          email: 'another@example.com',
          image: 'avatar.jpg',
        },
      },
    ]

    const mockSession: UserSession = {
      id: 'session-1',
      userId: 'user-1',
      token: 'test-token',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      impersonatedBy: null,
    }

    const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
      getRecordHistory: () => Effect.succeed({ entries: mockHistory, total: mockHistory.length }),
      checkRecordExists: () => Effect.succeed(true),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityRepository
      return yield* repo.getRecordHistory({
        session: mockSession,
        tableName: 'posts',
        recordId: 'post-1',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestActivityRepositoryLive)))

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]?.action).toBe('create')
    expect(result.entries[1]?.action).toBe('update')
    expect(result.entries[1]?.user?.image).toBe('avatar.jpg')
    expect(result.total).toBe(2)
  })

  test('should handle entries with undefined user', async () => {
    const mockHistory: readonly ActivityHistoryEntry[] = [
      {
        action: 'system-generated',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        changes: { status: 'active' },
        user: undefined,
      },
    ]

    const mockSession: UserSession = {
      id: 'session-1',
      userId: 'user-1',
      token: 'test-token',
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      impersonatedBy: null,
    }

    const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
      getRecordHistory: () => Effect.succeed({ entries: mockHistory, total: mockHistory.length }),
      checkRecordExists: () => Effect.succeed(true),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityRepository
      return yield* repo.getRecordHistory({
        session: mockSession,
        tableName: 'tables',
        recordId: 'table-1',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(TestActivityRepositoryLive)))

    expect(result.entries[0]?.user).toBeUndefined()
    expect(result.entries[0]?.action).toBe('system-generated')
    expect(result.total).toBe(1)
  })
})
