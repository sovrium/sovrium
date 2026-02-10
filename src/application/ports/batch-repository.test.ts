/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { BatchRepository, type BatchValidationError, type UpsertResult } from './batch-repository'
import type { UserSession } from './user-session'

describe('BatchRepository', () => {
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
    expect(BatchRepository).toBeDefined()
    expect(typeof BatchRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(BatchRepository)).toContain('BatchRepository')
  })

  test('should batch create records successfully', async () => {
    const mockRecords = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]

    const MockBatchRepositoryLive = Layer.succeed(BatchRepository, {
      batchCreate: (_session, _tableName, records) =>
        Effect.succeed(records.map((r, i) => ({ id: `record-${i}`, ...r }))),
      batchUpdate: () => Effect.succeed([]),
      batchDelete: () => Effect.succeed(0),
      batchRestore: () => Effect.succeed(0),
      upsert: () => Effect.succeed({ records: [], created: 0, updated: 0 } as UpsertResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* BatchRepository
      return yield* repo.batchCreate(mockSession, 'users', mockRecords)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockBatchRepositoryLive)))

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('id', 'record-0')
    expect(result[0]).toHaveProperty('name', 'Alice')
  })

  test('should batch update records successfully', async () => {
    const updates = [
      { id: 'record-1', fields: { name: 'Alice Updated' } },
      { id: 'record-2', fields: { name: 'Bob Updated' } },
    ]

    const MockBatchRepositoryLive = Layer.succeed(BatchRepository, {
      batchCreate: () => Effect.succeed([]),
      batchUpdate: (_session, _tableName, upd) =>
        Effect.succeed(upd.map((u) => ({ id: u.id, ...u.fields }))),
      batchDelete: () => Effect.succeed(0),
      batchRestore: () => Effect.succeed(0),
      upsert: () => Effect.succeed({ records: [], created: 0, updated: 0 } as UpsertResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* BatchRepository
      return yield* repo.batchUpdate(mockSession, 'users', updates)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockBatchRepositoryLive)))

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('name', 'Alice Updated')
  })

  test('should batch delete records successfully', async () => {
    const recordIds = ['record-1', 'record-2']

    const MockBatchRepositoryLive = Layer.succeed(BatchRepository, {
      batchCreate: () => Effect.succeed([]),
      batchUpdate: () => Effect.succeed([]),
      batchDelete: (_session, _tableName, ids) => Effect.succeed(ids.length),
      batchRestore: () => Effect.succeed(0),
      upsert: () => Effect.succeed({ records: [], created: 0, updated: 0 } as UpsertResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* BatchRepository
      return yield* repo.batchDelete(mockSession, 'users', recordIds)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockBatchRepositoryLive)))

    expect(result).toBe(2)
  })

  test('should batch restore records successfully', async () => {
    const recordIds = ['record-1', 'record-2']

    const MockBatchRepositoryLive = Layer.succeed(BatchRepository, {
      batchCreate: () => Effect.succeed([]),
      batchUpdate: () => Effect.succeed([]),
      batchDelete: () => Effect.succeed(0),
      batchRestore: (_session, _tableName, ids) => Effect.succeed(ids.length),
      upsert: () => Effect.succeed({ records: [], created: 0, updated: 0 } as UpsertResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* BatchRepository
      return yield* repo.batchRestore(mockSession, 'users', recordIds)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockBatchRepositoryLive)))

    expect(result).toBe(2)
  })

  test('should upsert records successfully', async () => {
    const records = [
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com', name: 'Bob' },
    ]
    const fieldsToMergeOn = ['email']

    const mockResult: UpsertResult = {
      records: records.map((r, i) => ({ id: `record-${i}`, ...r })),
      created: 1,
      updated: 1,
    }

    const MockBatchRepositoryLive = Layer.succeed(BatchRepository, {
      batchCreate: () => Effect.succeed([]),
      batchUpdate: () => Effect.succeed([]),
      batchDelete: () => Effect.succeed(0),
      batchRestore: () => Effect.succeed(0),
      upsert: () => Effect.succeed(mockResult),
    })

    const program = Effect.gen(function* () {
      const repo = yield* BatchRepository
      return yield* repo.upsert(mockSession, 'users', records, fieldsToMergeOn)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockBatchRepositoryLive)))

    expect(result.records).toHaveLength(2)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(1)
  })
})

describe('BatchValidationError interface', () => {
  test('should have correct shape', () => {
    const error: BatchValidationError = {
      _tag: 'BatchValidationError',
      message: 'Validation failed',
      name: 'BatchValidationError',
      details: ['Field "email" is required'],
    }

    expect(error._tag).toBe('BatchValidationError')
    expect(error.message).toBe('Validation failed')
    expect(error.details).toContain('Field "email" is required')
  })
})

describe('UpsertResult interface', () => {
  test('should have correct shape', () => {
    const result: UpsertResult = {
      records: [{ id: '1', name: 'Test' }],
      created: 1,
      updated: 0,
    }

    expect(result.records).toHaveLength(1)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
  })
})
