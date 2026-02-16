/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { UserRoleRepository, UserRoleDatabaseError } from './user-role-repository'

describe('UserRoleRepository', () => {
  test('should be a Context.Tag', () => {
    expect(UserRoleRepository).toBeDefined()
    expect(typeof UserRoleRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(UserRoleRepository)).toContain('UserRoleRepository')
  })

  test('should return user role via mock', async () => {
    const MockLayer = Layer.succeed(UserRoleRepository, {
      getUserRole: () => Effect.succeed('admin'),
    })

    const program = Effect.gen(function* () {
      const repo = yield* UserRoleRepository
      return yield* repo.getUserRole('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result).toBe('admin')
  })

  test('should return undefined for unknown user', async () => {
    const MockLayer = Layer.succeed(UserRoleRepository, {
      // @effect-diagnostics effect/effectSucceedWithVoid:off
      getUserRole: () => Effect.succeed(undefined),
    })

    const program = Effect.gen(function* () {
      const repo = yield* UserRoleRepository
      return yield* repo.getUserRole('unknown-user')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer)))

    expect(result).toBeUndefined()
  })

  test('should propagate UserRoleDatabaseError on failure', async () => {
    const MockLayer = Layer.succeed(UserRoleRepository, {
      getUserRole: () => Effect.fail(new UserRoleDatabaseError({ cause: 'connection timeout' })),
    })

    const program = Effect.gen(function* () {
      const repo = yield* UserRoleRepository
      return yield* repo.getUserRole('user-123')
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockLayer), Effect.either))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('UserRoleDatabaseError')
      expect(result.left.cause).toBe('connection timeout')
    }
  })
})
