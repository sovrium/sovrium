/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for First User Admin Configuration
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('First User Admin Configuration', () => {
  test(
    'API-AUTH-ADMIN-OPT-FIRST-USER-001: should make first registered user admin',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN: First user signs up
      const user = await signUp({ email: 'first@example.com', password: 'Pass123!', name: 'First' })

      // THEN: User is assigned admin role
      expect((user.user as { role?: string }).role).toBe('admin')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-002: should assign default role to subsequent users',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN: First user signs up
      const firstUser = await signUp({
        email: 'first@example.com',
        password: 'Pass123!',
        name: 'First',
      })
      expect((firstUser.user as { role?: string }).role).toBe('admin')

      // WHEN: Second user signs up
      const secondUser = await signUp({
        email: 'second@example.com',
        password: 'Pass123!',
        name: 'Second',
      })

      // THEN: Second user gets default role
      expect((secondUser.user as { role?: string }).role).toBe('user')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-003: should support disabling first-user-admin option',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp }) => {
      // GIVEN: Server with first-user-admin disabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: false },
        },
      })

      // WHEN: First user signs up
      const user = await signUp({ email: 'first@example.com', password: 'Pass123!', name: 'First' })

      // THEN: User is not assigned admin role
      expect((user.user as { role?: string }).role).toBe('user')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-004: should verify user is first via user count',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN: Check user count before signup
      const countBefore = await page.request.get('/api/auth/admin/user-count')
      expect(countBefore.status()).toBe(200)
      const { count: beforeCount } = await countBefore.json()
      expect(beforeCount).toBe(0)

      // WHEN: First user signs up
      const user = await signUp({ email: 'first@example.com', password: 'Pass123!', name: 'First' })

      // THEN: User is admin
      expect((user.user as { role?: string }).role).toBe('admin')

      // WHEN: Check user count after signup
      const countAfter = await page.request.get('/api/auth/admin/user-count')
      const { count: afterCount } = await countAfter.json()
      expect(afterCount).toBe(1)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-005: should apply admin permissions immediately',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN: First user signs up
      await signUp({ email: 'admin@example.com', password: 'Pass123!', name: 'Admin' })

      // THEN: User can immediately access admin endpoints
      const listUsers = await page.request.get('/api/auth/admin/list-users')
      expect(listUsers.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-006: should log first admin creation event',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN: First user signs up
      const user = await signUp({ email: 'admin@example.com', password: 'Pass123!', name: 'Admin' })

      // THEN: First admin creation is logged
      const logsResponse = await page.request.get('/api/auth/admin/audit-logs')
      expect(logsResponse.status()).toBe(200)
      const logs = await logsResponse.json()
      const firstAdminLog = logs.find((log: any) => log.action === 'first_admin_created')
      expect(firstAdminLog).toBeDefined()
      expect(firstAdminLog.userId).toBe(user.user.id)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-OPT-FIRST-USER-007: system can bootstrap with first user admin',
    { tag: '@regression' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with first-user-admin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: { firstUserAdmin: true },
        },
      })

      // WHEN/THEN: First user signs up and becomes admin
      const admin = await signUp({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      expect((admin.user as { role?: string }).role).toBe('admin')

      // WHEN/THEN: Admin can manage users
      const listUsers = await page.request.get('/api/auth/admin/list-users')
      expect(listUsers.status()).toBe(200)

      // WHEN/THEN: Subsequent users get default role
      const user = await signUp({ email: 'user@example.com', password: 'Pass123!', name: 'User' })
      expect((user.user as { role?: string }).role).toBe('user')

      // WHEN/THEN: Only first user is admin
      const allUsers = await page.request.get('/api/auth/admin/list-users')
      const users = await allUsers.json()
      const adminUsers = users.filter((u: any) => u.role === 'admin')
      expect(adminUsers.length).toBe(1)
      expect(adminUsers[0].id).toBe(admin.user.id)
    }
  )
})
