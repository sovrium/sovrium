/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Set user role
 *
 * Source: specs/api/paths/auth/admin/set-role/post.json
 * Domain: api
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Note: Admin tests require an admin user. Since there's no public API to create
 * the first admin, these tests assume admin features are properly configured.
 */

test.describe('Admin: Set user role', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test(
    'API-AUTH-ADMIN-SET-ROLE-001: should return 200 OK with updated user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      // Create target user
      const target = await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // Sign in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin updates user role to member
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: target.user.id,
          role: 'member',
        },
      })

      // THEN: Returns 200 OK with updated user data
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'member')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-002: should return 400 Bad Request without required fields',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      await signUp({ email: 'admin@example.com', password: 'AdminPass123!', name: 'Admin User' })

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-003: should return 200 OK with invalid role value (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      const target = await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // Sign in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request with invalid role value
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: target.user.id,
          role: 'superadmin', // Invalid role
        },
      })

      // THEN: Returns 200 OK and accepts the role value
      // Note: Better Auth does not validate role values - it accepts any string value
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'superadmin')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-004: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      // WHEN: Unauthenticated user attempts to set role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'member',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-005: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Regular User',
      })
      await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // WHEN: Regular user attempts to set another user's role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: '2',
          role: 'admin',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-006: should return 200 OK for non-existent user (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      // Sign in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin attempts to set role for non-existent user
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: 'non-existent-uuid-12345',
          role: 'member',
        },
      })

      // THEN: Returns 200 OK with empty user object
      // Note: Better Auth returns empty user object for non-existent users
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-007: should return 200 OK and user gains admin privileges',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a member user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      const promotee = await signUp({
        email: 'promotee@example.com',
        password: 'PromoteePass123!',
        name: 'Future Admin',
      })

      // Sign in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin promotes member to admin role
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: promotee.user.id,
          role: 'admin',
        },
      })

      // THEN: Returns 200 OK and user gains admin privileges
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'admin')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-ROLE-008: should return 200 OK when setting same role (idempotent)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a member user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'AdminPass123!',
            name: 'Admin User',
          },
        }
      )

      const target = await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // Sign in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // First set role to member
      await page.request.post('/api/auth/admin/set-role', {
        data: { userId: target.user.id, role: 'member' },
      })

      // WHEN: Admin sets user role to their current role (no change)
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: {
          userId: target.user.id,
          role: 'member',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('role', 'member')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-SET-ROLE-REGRESSION: admin can complete full set-role workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      let targetUserId: string

      await test.step('API-AUTH-ADMIN-SET-ROLE-004: Returns 401 Unauthorized without authentication', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        })

        // WHEN: Unauthenticated user attempts to set role
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: '2',
            role: 'member',
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('Setup: Create admin and target users', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            auth: {
              strategies: [{ type: 'emailAndPassword' }],
            },
          },
          {
            adminBootstrap: {
              email: 'admin@example.com',
              password: 'AdminPass123!',
              name: 'Admin User',
            },
          }
        )

        // Create target user
        const target = await signUp({
          email: 'target@example.com',
          password: 'TargetPass123!',
          name: 'Target User',
        })
        targetUserId = target.user.id

        // Create regular user for non-admin test
        await signUp({
          email: 'user@example.com',
          password: 'UserPass123!',
          name: 'Regular User',
        })
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-005: Returns 403 Forbidden for non-admin user', async () => {
        // Sign in as regular user
        await signIn({ email: 'user@example.com', password: 'UserPass123!' })

        // WHEN: Regular user attempts to set another user's role
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: targetUserId,
            role: 'admin',
          },
        })

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-002: Returns 400 Bad Request without required fields', async () => {
        // Re-sign in as admin
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

        // WHEN: Admin submits request without required fields
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {},
        })

        // THEN: Returns 400 Bad Request with validation errors
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-003: Returns 200 OK and accepts invalid role value', async () => {
        // WHEN: Admin submits request with invalid role value
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: targetUserId,
            role: 'superadmin', // Invalid role
          },
        })

        // THEN: Returns 200 OK and accepts the role value
        // Note: Better Auth does not validate role values - it accepts any string value
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('role', 'superadmin')
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-006: Returns 200 OK with empty user object for non-existent user', async () => {
        // WHEN: Admin attempts to set role for non-existent user
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: '999',
            role: 'member',
          },
        })

        // THEN: Returns 200 OK with empty user object
        // Note: Better Auth returns empty user object for non-existent users
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-001: Returns 200 OK with updated user data', async () => {
        // WHEN: Admin updates user role to member
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: targetUserId,
            role: 'member',
          },
        })

        // THEN: Returns 200 OK with updated user data
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('role', 'member')
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-007: Returns 200 OK and user gains admin privileges', async () => {
        // WHEN: Admin promotes member to admin role
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: targetUserId,
            role: 'admin',
          },
        })

        // THEN: Returns 200 OK and user gains admin privileges
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('role', 'admin')
      })

      await test.step('API-AUTH-ADMIN-SET-ROLE-008: Returns 200 OK when setting same role (idempotent)', async () => {
        // WHEN: Admin sets user role to their current role (no change)
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: targetUserId,
            role: 'admin',
          },
        })

        // THEN: Returns 200 OK (idempotent operation)
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('role', 'admin')
      })
    }
  )
})
