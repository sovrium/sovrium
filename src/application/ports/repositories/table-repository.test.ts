/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  TableRepository,
  type QueryFilter,
  type AggregateQuery,
  type AggregationResult,
} from './table-repository'
import type { UserSession } from '@/application/ports/models/user-session'

describe('TableRepository', () => {
  const mockSession: UserSession = {
    id: 'session-123',
    userId: 'user-456',
    token: 'token-789',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    impersonatedBy: null,
  }

  test('should be a Context.Tag', () => {
    expect(TableRepository).toBeDefined()
    expect(typeof TableRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(TableRepository)).toContain('TableRepository')
  })

  test('should list records successfully', async () => {
    const mockRecords = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed(mockRecords),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.listRecords({ session: mockSession, tableName: 'users' })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('name', 'Alice')
  })

  test('should list trash records successfully', async () => {
    const mockTrash = [{ id: '3', name: 'Deleted User', deletedAt: new Date() }]

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed(mockTrash),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.listTrash({ session: mockSession, tableName: 'users' })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('name', 'Deleted User')
  })

  test('should get record by ID successfully', async () => {
    const mockRecord = { id: '1', name: 'Alice' }

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: (_session, _tableName, recordId) =>
        Effect.succeed(recordId === '1' ? mockRecord : null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.getRecord(mockSession, 'users', '1')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveProperty('name', 'Alice')
  })

  test('should create record successfully', async () => {
    const newRecord = { name: 'Charlie', email: 'charlie@example.com' }
    const createdRecord = { id: '3', ...newRecord }

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed(createdRecord),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.createRecord(mockSession, 'users', newRecord)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveProperty('id', '3')
    expect(result).toHaveProperty('name', 'Charlie')
  })

  test('should update record successfully', async () => {
    const updatedRecord = { id: '1', name: 'Alice Updated' }

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed(updatedRecord),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.updateRecord(mockSession, 'users', '1', {
        fields: { name: 'Alice Updated' },
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveProperty('name', 'Alice Updated')
  })

  test('should delete record successfully', async () => {
    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(true),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.deleteRecord(mockSession, 'users', '1')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toBe(true)
  })

  test('should permanently delete record successfully', async () => {
    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(true),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.permanentlyDeleteRecord(mockSession, 'users', '1')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toBe(true)
  })

  test('should restore record successfully', async () => {
    const restoredRecord = { id: '1', name: 'Restored User', deletedAt: null }

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(restoredRecord),
      computeAggregations: () => Effect.succeed({} as AggregationResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.restoreRecord(mockSession, 'users', '1')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result).toHaveProperty('name', 'Restored User')
  })

  test('should compute aggregations successfully', async () => {
    const mockAggregation: AggregationResult = {
      count: '42',
      sum: { revenue: 10_000 },
      avg: { revenue: 250 },
      min: { revenue: 50 },
      max: { revenue: 1000 },
    }

    const MockTableRepositoryLive = Layer.succeed(TableRepository, {
      listRecords: () => Effect.succeed([]),
      listTrash: () => Effect.succeed([]),
      getRecord: () => Effect.succeed(null),
      createRecord: () => Effect.succeed({}),
      updateRecord: () => Effect.succeed({}),
      deleteRecord: () => Effect.succeed(false),
      permanentlyDeleteRecord: () => Effect.succeed(false),
      restoreRecord: () => Effect.succeed(null),
      computeAggregations: () => Effect.succeed(mockAggregation),
    })

    const program = Effect.gen(function* () {
      const repo = yield* TableRepository
      const aggregate: AggregateQuery = {
        count: true,
        sum: ['revenue'],
        avg: ['revenue'],
        min: ['revenue'],
        max: ['revenue'],
      }
      return yield* repo.computeAggregations({
        session: mockSession,
        tableName: 'orders',
        aggregate,
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockTableRepositoryLive)))

    expect(result.count).toBe('42')
    expect(result.sum?.revenue).toBe(10_000)
  })
})

describe('QueryFilter interface', () => {
  test('should have correct shape', () => {
    const filter: QueryFilter = {
      and: [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'age', operator: 'gt', value: 18 },
      ],
    }

    expect(filter.and).toHaveLength(2)
    expect(filter.and?.[0]?.field).toBe('status')
  })
})

describe('AggregateQuery interface', () => {
  test('should have correct shape', () => {
    const aggregate: AggregateQuery = {
      count: true,
      sum: ['revenue', 'profit'],
      avg: ['revenue'],
      min: ['price'],
      max: ['price'],
    }

    expect(aggregate.count).toBe(true)
    expect(aggregate.sum).toContain('revenue')
  })
})

describe('AggregationResult interface', () => {
  test('should have correct shape', () => {
    const result: AggregationResult = {
      count: '100',
      sum: { revenue: 5000 },
      avg: { revenue: 50 },
      min: { price: 10 },
      max: { price: 100 },
    }

    expect(result.count).toBe('100')
    expect(result.sum?.revenue).toBe(5000)
  })
})
