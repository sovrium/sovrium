/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Assign Admin Role
 *
 * Domain: api
 * Spec Count: 6
 */

test.describe('Assign Admin Role', () => {
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-001: should return 200 OK when assigning admin role',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, signUp, page }) => {
      // GIVEN: Server with admin plugin and admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // WHEN: Admin assigns admin role to user
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'admin' },
      })

      // THEN: Returns 200 OK
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect((data.user as { role?: string }).role).toBe('admin')
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-002: should grant admin permissions to user',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, signUp, page }) => {
      // GIVEN: Server with admin plugin and users
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // WHEN: Admin assigns admin role
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'admin' },
      })

      // THEN: User can access admin endpoints
      const testResponse = await page.request.get('/api/auth/admin/list-users')
      expect(testResponse.status()).toBe(200)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-003: should return 403 when non-admin tries to assign',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })
      const target = await signUp({
        email: 'target@example.com',
        password: 'Pass123!',
        name: 'Target',
      })

      // WHEN: Non-admin tries to assign admin role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: target.user.id, role: 'admin' },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-004: should return 404 when user not found',
    { tag: '@spec' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, page }) => {
      // GIVEN: Server with admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })

      // WHEN: Admin assigns role to non-existent user
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: 'non-existent-id', role: 'admin' },
      })

      // THEN: Returns 404 Not Found
      expect(response.status()).toBe(404)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-005: should prevent self-assignment without permission',
    { tag: '@spec' },
    async ({ startServerWithSchema, signUp, page }) => {
      // GIVEN: Server with regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // WHEN: User tries to assign admin role to themselves
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'admin' },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-006: should return 401 when not authenticated',
    { tag: '@spec' },
    async ({ startServerWithSchema, request }) => {
      // GIVEN: Server with admin plugin (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })

      // WHEN: Unauthenticated request to assign role
      const response = await request.post('/api/auth/admin/set-role', {
        data: { userId: 'some-id', role: 'admin' },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )
  test.fixme(
    'API-AUTH-ADMIN-ASSIGN-007: admin can assign role and verify permissions apply',
    { tag: '@regression' },
    async ({ startServerWithSchema, createAuthenticatedAdmin: createAdmin, signUp, page }) => {
      // GIVEN: Server with admin plugin, admin user, and regular user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: {
            roleManagement: {},
          },
        },
      })
      await createAdmin({
        email: 'admin@example.com',
        password: 'Pass123!',
        name: 'Admin',
      })
      const user = await signUp({
        email: 'user@example.com',
        password: 'Pass123!',
        name: 'User',
      })

      // WHEN: Admin assigns admin role to user
      const assignResponse = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: user.user.id, role: 'admin' },
      })

      // THEN: Role assignment succeeds
      expect(assignResponse.status()).toBe(200)

      // THEN: User can now access admin endpoints
      const testResponse = await page.request.get('/api/auth/admin/list-users')
      expect(testResponse.status()).toBe(200)

      const data = await testResponse.json()
      expect(data.users).toBeDefined()
      expect(data.users.length).toBeGreaterThan(0)
    }
  )
})
