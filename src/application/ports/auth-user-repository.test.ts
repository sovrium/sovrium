/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AuthUserRepository, AuthUserDatabaseError } from './auth-user-repository'

describe('AuthUserRepository', () => {
  test('should be a Context.Tag', () => {
    expect(AuthUserRepository).toBeDefined()
    expect(typeof AuthUserRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(AuthUserRepository)).toContain('AuthUserRepository')
  })

  test('should verify user email via mock', async () => {
    let verifiedUserId: string | undefined

    const MockLayer = Layer.succeed(AuthUserRepository, {
      verifyUserEmail: (userId: string) =>
        Effect.sync(() => {
          verifiedUserId = userId
        }),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthUserRepository
      return yield* repo.verifyUserEmail('user-123')
    })

    await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(verifiedUserId).toBe('user-123')
  })

  test('should propagate AuthUserDatabaseError on failure', async () => {
    const MockLayer = Layer.succeed(AuthUserRepository, {
      verifyUserEmail: () =>
        Effect.fail(new AuthUserDatabaseError({ cause: 'connection timeout' })),
    })

    const program = Effect.gen(function* () {
      const repo = yield* AuthUserRepository
      return yield* repo.verifyUserEmail('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer), Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('AuthUserDatabaseError')
      expect(result.left.cause).toBe('connection timeout')
    }
  })
})
