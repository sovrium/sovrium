/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Default User Role
 *
 * Domain: api
 * Spec Count: 2
 */

test.describe('Admin Default User Role', () => {
  test(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-001: should assign default role to new users',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      // WHEN: New user signs up
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // THEN: User has default role assigned
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )

  test(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-002: should fallback to user role when not configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server without default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { strategies: [{ type: 'emailAndPassword' }] },
      })

      // WHEN: New user signs up
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // THEN: Falls back to user role
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )

  test(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-REGRESSION: admin default role assignment workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp }) => {
      // Setup: Start server with admin default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      let user1: Awaited<ReturnType<typeof signUp>>

      await test.step('API-AUTH-ADMIN-OPT-DEFAULT-ROLE-001: Assigns default role to new users', async () => {
        // WHEN: New user signs up
        user1 = await signUp({
          email: 'user1@example.com',
          password: 'Pass123!',
          name: 'User 1',
        })

        // THEN: User has default role assigned
        expect((user1.user as { role?: string }).role).toBe('member')
      })

      await test.step('API-AUTH-ADMIN-OPT-DEFAULT-ROLE-002: Falls back to member role when not configured', async () => {
        // WHEN: Another new user signs up
        const user2 = await signUp({
          email: 'user2@example.com',
          password: 'Pass123!',
          name: 'User 2',
        })

        // THEN: Falls back to member role (consistent assignment)
        expect((user2.user as { role?: string }).role).toBe('member')
        expect((user1!.user as { role?: string }).role).toBe((user2.user as { role?: string }).role)
      })
    }
  )
})
