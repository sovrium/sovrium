/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock } from 'bun:test'
import { Effect, Context, Layer } from 'effect'

// Mock the infrastructure service before importing
mock.module('@/infrastructure/database/repositories/auth-repository-live', () => {
  class AuthRepository extends Context.Tag('AuthRepository')() {}

  return {
    AuthRepository,
    AuthRepositoryLive: Layer.succeed(AuthRepository, {
      verifyUserEmail: (_userId: string) => Effect.void,
      getUserRole: (_userId: string) => Effect.succeed('admin'),
    }),
  }
})

// Mock the port to match the mock module
mock.module('@/application/ports/repositories/auth-repository', () => {
  class AuthRepository extends Context.Tag('AuthRepository')() {}

  return {
    AuthRepository,
    AuthDatabaseError: class extends Error {
      readonly _tag = 'AuthDatabaseError'
    },
  }
})

// Import after mocking
const { getUserRole } = await import('./user-role')

describe('getUserRole', () => {
  test('should return role from AuthRepository', async () => {
    const role = await getUserRole('user-123')
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    // Reset mock for this test
    mock.module('@/infrastructure/database/repositories/auth-repository-live', () => {
      class AuthRepository extends Context.Tag('AuthRepository')() {}

      return {
        AuthRepository,
        AuthRepositoryLive: Layer.succeed(AuthRepository, {
          verifyUserEmail: (_userId: string) => Effect.void,
          getUserRole: (_userId: string) => Effect.void,
        }),
      }
    })

    mock.module('@/application/ports/repositories/auth-repository', () => {
      class AuthRepository extends Context.Tag('AuthRepository')() {}

      return {
        AuthRepository,
        AuthDatabaseError: class extends Error {
          readonly _tag = 'AuthDatabaseError'
        },
      }
    })

    const { getUserRole: getUserRoleRefresh } = await import('./user-role')
    const role = await getUserRoleRefresh('user-456')
    expect(role).toBe('member')
  })
})
