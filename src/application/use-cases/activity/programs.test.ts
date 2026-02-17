/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { Database, type DrizzleDB } from '@/infrastructure/database'
import { GetActivityById, InvalidActivityIdError } from './programs'
import type {
  ActivityDatabaseError,
  ActivityNotFoundError,
} from '@/infrastructure/database/activity-queries'

describe('GetActivityById', () => {
  const mockActivity = {
    id: 'abc12345-1234-1234-1234-abcdef123456',
    userId: 'user-1',
    action: 'create',
    tableName: 'tasks',
    recordId: 42,
    changes: { title: 'Task 1' },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    user: {
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
    },
  }

  const mockDb = {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockActivity]),
          }),
        }),
      }),
    }),
  }

  const DatabaseTestLive = Layer.succeed(Database, mockDb as unknown as DrizzleDB)

  test('should return activity for valid UUID', async () => {
    const program = GetActivityById('abc12345-1234-1234-1234-abcdef123456').pipe(
      Effect.provide(DatabaseTestLive)
    )

    const result = await Effect.runPromise(program)

    expect(result.id).toBe('abc12345-1234-1234-1234-abcdef123456')
    expect(result.tableName).toBe('tasks')
  })

  test('should return activity for valid numeric ID', async () => {
    const program = GetActivityById('42').pipe(Effect.provide(DatabaseTestLive))

    const result = await Effect.runPromise(program)

    expect(result.id).toBe('abc12345-1234-1234-1234-abcdef123456')
  })

  test('should fail with InvalidActivityIdError for empty string', async () => {
    const program = GetActivityById('').pipe(Effect.provide(DatabaseTestLive), Effect.either)

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('InvalidActivityIdError')
      expect(result.left).toBeInstanceOf(InvalidActivityIdError)
    }
  })

  test('should fail with InvalidActivityIdError for non-UUID non-numeric string', async () => {
    const program = GetActivityById('invalid-id').pipe(
      Effect.provide(DatabaseTestLive),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('InvalidActivityIdError')
    }
  })

  test('should fail with ActivityNotFoundError when DB returns empty', async () => {
    const emptyDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }

    const EmptyDatabaseLive = Layer.succeed(Database, emptyDb as unknown as DrizzleDB)

    const program = GetActivityById('abc12345-1234-1234-1234-abcdef123456').pipe(
      Effect.provide(EmptyDatabaseLive),
      Effect.either
    )

    const result = await Effect.runPromise(program)

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      const error = result.left as
        | ActivityNotFoundError
        | ActivityDatabaseError
        | InvalidActivityIdError
      expect(error._tag).toBe('ActivityNotFoundError')
    }
  })
})
