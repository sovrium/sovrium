/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'

/**
 * Dynamic import to bypass Bun mock.module() contamination.
 *
 * Other test files (e.g., table.test.ts) use mock.module() to replace
 * the user-role module at the process level. Since Bun runs all unit
 * tests in a shared process, static imports may receive the mocked
 * version. Dynamic import with a cache-busting query string ensures
 * we always get the real implementation.
 */
async function loadGetUserRole() {
  const mod = await import(`./user-role?t=${Date.now()}`)
  return mod.getUserRole
}

describe('getUserRole', () => {
  test('should return role from AuthRepository', async () => {
    const getUserRole = await loadGetUserRole()

    const mockService = {
      getUserRole: () => Effect.succeed('admin' as string | undefined),
    }

    const role = await getUserRole('user-123', mockService)
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    const getUserRole = await loadGetUserRole()

    const mockService = {
      getUserRole: () => Effect.succeed(undefined),
    }

    const role = await getUserRole('user-456', mockService)
    expect(role).toBe('member')
  })
})
