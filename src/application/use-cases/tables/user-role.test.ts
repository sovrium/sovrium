/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock } from 'bun:test'
import { Effect, Layer } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth-repository'

// IMPORTANT: Clear any leaked module mocks from other test files (e.g., crud.test.ts).
// Bun's mock.module() can leak across files on Linux when test files share a process.
// We call mock.restore() BEFORE dynamically importing the modules under test
// to ensure we get the real implementations, not mocked versions.
mock.restore()

const { getUserRole } = await import('./user-role')

describe('getUserRole', () => {
  test('should return role from AuthRepository', async () => {
    const mockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.void,
      getUserRole: () => Effect.succeed('admin' as string | undefined),
    })

    const role = await getUserRole('user-123', mockLayer)
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    const mockLayer = Layer.succeed(AuthRepository, {
      verifyUserEmail: () => Effect.void,
      getUserRole: () => Effect.succeed(undefined),
    })

    const role = await getUserRole('user-456', mockLayer)
    expect(role).toBe('member')
  })
})
