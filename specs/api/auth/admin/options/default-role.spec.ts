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
 * Spec Count: 6
 */

test.describe('Admin Default User Role', () => {
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-001: should assign default role to new users',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { defaultRole: 'user' },
        },
      })

      // WHEN: New user signs up
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // THEN: User has default role assigned
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-002: should support custom default role configuration',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with custom default role
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { defaultRole: 'viewer' },
        },
      })

      // WHEN: New user signs up
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // THEN: User has custom default role
      expect((user.user as { role?: string }).role).toBe('viewer')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-003: should apply default role on sign-up',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { defaultRole: 'user' },
        },
      })

      // WHEN: User signs up
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // THEN: Default role is applied immediately
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-004: should fallback to user role when not configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server without default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true, admin: true },
      })

      // WHEN: New user signs up
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // THEN: Falls back to user role
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-005: should validate default role exists',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Server configuration with invalid default role
      // WHEN: Server starts with invalid role
      // THEN: Throws configuration error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: { defaultRole: 'non-existent-role' as 'user' }, // intentional invalid value for testing
          },
        })
      ).rejects.toThrow(/invalid.*role/i)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-006: should allow changing default role',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Server with default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { defaultRole: 'user' },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Admin changes default role configuration
      const response = await page.request.post('/api/auth/admin/update-config', {
        data: { defaultRole: 'viewer' },
      })

      // THEN: Configuration updated successfully
      expect(response.status()).toBe(200)

      // WHEN: New user signs up
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })

      // THEN: User gets new default role
      expect((user.user as { role?: string }).role).toBe('viewer')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-DEFAULT-ROLE-007: system can manage default role assignment',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with default role configured
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { defaultRole: 'user' },
        },
      })

      // WHEN/THEN: Multiple users sign up
      const user1 = await signUp({
        email: 'user1@example.com',
        password: 'Pass123!',
        name: 'User 1',
      })
      expect((user1.user as { role?: string }).role).toBe('user')

      const user2 = await signUp({
        email: 'user2@example.com',
        password: 'Pass123!',
        name: 'User 2',
      })
      expect((user2.user as { role?: string }).role).toBe('user')

      // WHEN/THEN: All users have consistent default role
      expect((user1.user as { role?: string }).role).toBe((user2.user as { role?: string }).role)
    }
  )
})
