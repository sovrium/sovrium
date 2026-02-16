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
  class UserRoleService extends Context.Tag('UserRoleService')() {}

  return {
    UserRoleService,
    UserRoleServiceLive: Layer.succeed(UserRoleService, {
      getUserRole: (_userId: string) => Effect.succeed('admin'),
    }),
  }
})

// Import after mocking
const { getUserRole } = await import('./user-role')

describe('getUserRole', () => {
  test('should return role from UserRoleService', async () => {
    const role = await getUserRole('user-123')
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    // Reset mock for this test
    mock.module('@/infrastructure/services/user-role-service', () => {
      class UserRoleService extends Context.Tag('UserRoleService')() {}

      return {
        UserRoleService,
        UserRoleServiceLive: Layer.succeed(UserRoleService, {
          getUserRole: (_userId: string) => Effect.succeed(undefined),
        }),
      }
    })

    const { getUserRole: getUserRoleRefresh } = await import('./user-role')
    const role = await getUserRoleRefresh('user-456')
    expect(role).toBe('member')
  })
})
