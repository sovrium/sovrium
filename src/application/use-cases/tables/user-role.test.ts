/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { getUserRole } from './user-role'

describe('getUserRole', () => {
  test('should return role from AuthRepository', async () => {
    const mockService = {
      getUserRole: async () => 'admin' as string | undefined,
    }

    const role = await getUserRole('user-123', mockService)
    expect(role).toBe('admin')
  })

  test('should return default role when service returns undefined', async () => {
    const mockService = {
      getUserRole: async () => undefined,
    }

    const role = await getUserRole('user-456', mockService)
    expect(role).toBe('member')
  })
})
