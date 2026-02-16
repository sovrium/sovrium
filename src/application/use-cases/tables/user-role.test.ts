/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock } from 'bun:test'
import { Effect, Context, Layer } from 'effect'

// Mock the infrastructure service before importing
mock.module('@/infrastructure/services/user-role-service', () => {
  class UserRoleRepository extends Context.Tag('UserRoleRepository')() {}

  return {
    UserRoleRepository,
    UserRoleRepositoryLive: Layer.succeed(UserRoleRepository, {
      getUserRole: (_userId: string) => Effect.succeed('admin'),
    }),
  }
})

// Mock the port to match the mock module
mock.module('@/application/ports/user-role-repository', () => {
  class UserRoleRepository extends Context.Tag('UserRoleRepository')() {}

  return {
    UserRoleRepository,
    UserRoleDatabaseError: class extends Error {
      readonly _tag = 'UserRoleDatabaseError'
    },
  }
})

// Import after mocking
const { getUserRole } = await import('./user-role')

describe('getUserRole', () => {
  test('should return role from UserRoleRepository', async () => {
    const role = await getUserRole('user-123')
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    // Reset mock for this test
    mock.module('@/infrastructure/services/user-role-service', () => {
      class UserRoleRepository extends Context.Tag('UserRoleRepository')() {}

      return {
        UserRoleRepository,
        UserRoleRepositoryLive: Layer.succeed(UserRoleRepository, {
          getUserRole: (_userId: string) => Effect.succeed(undefined),
        }),
      }
    })

    mock.module('@/application/ports/user-role-repository', () => {
      class UserRoleRepository extends Context.Tag('UserRoleRepository')() {}

      return {
        UserRoleRepository,
        UserRoleDatabaseError: class extends Error {
          readonly _tag = 'UserRoleDatabaseError'
        },
      }
    })

    const { getUserRole: getUserRoleRefresh } = await import('./user-role')
    const role = await getUserRoleRefresh('user-456')
    expect(role).toBe('member')
  })
})
