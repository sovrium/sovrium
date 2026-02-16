/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ActivityLogRepository, ActivityLogDatabaseError } from './activity-log-repository'

describe('ActivityLogRepository', () => {
  test('should be a Context.Tag', () => {
    expect(ActivityLogRepository).toBeDefined()
    expect(typeof ActivityLogRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(ActivityLogRepository)).toContain('ActivityLogRepository')
  })

  test('should list all activity logs via mock', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        userId: 'user-1',
        sessionId: null,
        action: 'create' as const,
        tableName: 'tasks',
        tableId: 'table-1',
        recordId: 'record-1',
        changes: null,
        ipAddress: null,
        userAgent: null,
      },
    ]

    const MockLayer = Layer.succeed(ActivityLogRepository, {
      listAll: () => Effect.succeed(mockLogs),
      create: () => Effect.succeed(mockLogs[0]!),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityLogRepository
      return yield* repo.listAll()
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('log-1')
    expect(result[0]!.action).toBe('create')
  })

  test('should create an activity log via mock', async () => {
    const mockLog = {
      id: 'log-new',
      createdAt: new Date(),
      userId: 'user-1',
      sessionId: null,
      action: 'update' as const,
      tableName: 'projects',
      tableId: 'table-1',
      recordId: 'record-99',
      changes: null,
      ipAddress: null,
      userAgent: null,
    }

    const MockLayer = Layer.succeed(ActivityLogRepository, {
      listAll: () => Effect.succeed([]),
      create: () => Effect.succeed(mockLog),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityLogRepository
      return yield* repo.create({
        userId: 'user-1',
        action: 'update',
        tableName: 'projects',
        tableId: 'table-1',
        recordId: 'record-99',
        changes: {},
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result.id).toBe('log-new')
    expect(result.action).toBe('update')
  })

  test('should propagate ActivityLogDatabaseError on failure', async () => {
    const MockLayer = Layer.succeed(ActivityLogRepository, {
      listAll: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'connection refused' })),
      create: () => Effect.fail(new ActivityLogDatabaseError({ cause: 'connection refused' })),
    })

    const program = Effect.gen(function* () {
      const repo = yield* ActivityLogRepository
      return yield* repo.listAll()
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer), Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('ActivityLogDatabaseError')
      expect(result.left.cause).toBe('connection refused')
    }
  })
})
