/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AuthRepository, AuthDatabaseError } from './auth-repository'

describe('AuthRepository', () => {
  test('should be a Context.Tag', () => {
    expect(AuthRepository).toBeDefined()
    expect(typeof AuthRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(AuthRepository)).toContain('AuthRepository')
  })

  test('should verify user email via mock', async () => {
    let verifiedUserId: string | undefined

    const MockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: (userId: string) =>
        Effect.sync(() => {
          verifiedUserId = userId
        }),
      getUserRole: () => Effect.succeed('admin'),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthRepository
      return yield* repo.verifyUserEmail('user-123')
    })

    await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(verifiedUserId).toBe('user-123')
  })

  test('should return user role via mock', async () => {
    const MockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.void,
      getUserRole: () => Effect.succeed('admin'),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthRepository
      return yield* repo.getUserRole('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result).toBe('admin')
  })

  test('should return undefined for unknown user', async () => {
    const MockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.void,
      // @effect-diagnostics effect/effectSucceedWithVoid:off
      getUserRole: () => Effect.succeed(undefined),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthRepository
      return yield* repo.getUserRole('unknown-user')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result).toBeUndefined()
  })

  test('should propagate AuthDatabaseError on verifyUserEmail failure', async () => {
    const MockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.fail(new AuthDatabaseError({ cause: 'connection timeout' })),
      getUserRole: () => Effect.succeed('admin'),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthRepository
      return yield* repo.verifyUserEmail('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer), Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(AuthDatabaseError)
      expect(result.left._tag).toBe('AuthDatabaseError')
    }
  })

  test('should propagate AuthDatabaseError on getUserRole failure', async () => {
    const MockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.void,
      getUserRole: () => Effect.fail(new AuthDatabaseError({ cause: 'connection timeout' })),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthRepository
      return yield* repo.getUserRole('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer), Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(AuthDatabaseError)
      expect(result.left._tag).toBe('AuthDatabaseError')
    }
  })
})
