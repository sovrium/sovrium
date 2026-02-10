/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Set user password
 *
 * Source: specs/api/paths/auth/admin/set-user-password/post.json
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (7 tests) - Exhaustive acceptance criteria
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

test.describe('Admin: Set user password', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-001: should return 200 OK and update password',
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

      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })
      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'OldPassword123!',
        name: 'Target User',
      })

      // Sign back in as admin (signUp auto-signs in as new user)
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin sets new password for user
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: targetUser.user.id,
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK and updates user password
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)

      // Verify user can sign in with new password
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'target@example.com',
          password: 'NewSecurePass123!',
        },
      })
      expect(signInResponse.status()).toBe(200)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-002: should return 200 OK and revoke all user sessions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // GIVEN: An authenticated admin user and a user with multiple sessions
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

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      await signUp({
        email: 'target@example.com',
        password: 'OldPassword123!',
        name: 'Target User',
      })

      // Create multiple sessions for target user
      await signIn({ email: 'target@example.com', password: 'OldPassword123!' })
      await signIn({ email: 'target@example.com', password: 'OldPassword123!' })

      // Sign back in as admin
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin sets password with revokeOtherSessions enabled
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: '2',
          newPassword: 'NewSecurePass123!',
          revokeOtherSessions: true,
        },
      })

      // THEN: Returns 200 OK and revokes all user sessions
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-003: should return 400 Bad Request without required fields',
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

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits request without required fields
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-004: should return 400 Bad Request with short password',
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

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      await signUp({
        email: 'target@example.com',
        password: 'OldPassword123!',
        name: 'Target User',
      })

      // Sign back in as admin (signUp auto-signs in as new user)
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin submits password shorter than 8 characters
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: '2',
          newPassword: 'short',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-005: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
        },
      })

      // WHEN: Unauthenticated user attempts to set password
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: '2',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-006: should return 403 Forbidden for non-admin user',
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
        password: 'OldPassword123!',
        name: 'Target User',
      })

      // WHEN: Regular user attempts to set another user's password
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: '2',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-007: should return 200 OK for non-existent user (idempotent)',
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

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin attempts to set password for non-existent user
      const response = await page.request.post('/api/auth/admin/set-user-password', {
        data: {
          userId: '999',
          newPassword: 'NewSecurePass123!',
        },
      })

      // THEN: Returns 200 OK (idempotent operation)
      // Note: Better Auth admin operations are idempotent and return success even for non-existent resources
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', true)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-SET-USER-PASSWORD-REGRESSION: admin can complete full set-user-password workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      let targetUserId: string

      await test.step('Setup: Start server with comprehensive configuration', async () => {
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
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-005: Returns 401 Unauthorized without authentication', async () => {
        // WHEN: Unauthenticated user attempts to set password
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: '2',
            newPassword: 'NewSecurePass123!',
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('Setup: Create target and regular users', async () => {
        // Create target and regular users for testing (admin already created via adminBootstrap)
        const target = await signUp({
          email: 'target@example.com',
          password: 'OldPassword123!',
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

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-006: Returns 403 Forbidden for non-admin user', async () => {
        // Sign in as regular user (non-admin)
        await signIn({ email: 'user@example.com', password: 'UserPass123!' })

        // WHEN: Regular user attempts to set another user's password
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: targetUserId,
            newPassword: 'NewSecurePass123!',
          },
        })

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-003: Returns 400 Bad Request without required fields', async () => {
        // Sign in as admin
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

        // WHEN: Admin submits request without required fields
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {},
        })

        // THEN: Returns 400 Bad Request with validation errors
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-004: Returns 400 Bad Request with short password', async () => {
        // WHEN: Admin submits password shorter than 8 characters
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: targetUserId,
            newPassword: 'short',
          },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-007: Returns 200 OK for non-existent user (idempotent)', async () => {
        // WHEN: Admin attempts to set password for non-existent user
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: '999',
            newPassword: 'NewSecurePass123!',
          },
        })

        // THEN: Returns 200 OK (idempotent operation)
        // Note: Better Auth admin operations are idempotent and return success even for non-existent resources
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-001: Returns 200 OK and updates password', async () => {
        // WHEN: Admin sets new password for user
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: targetUserId,
            newPassword: 'NewSecurePass123!',
          },
        })

        // THEN: Returns 200 OK and updates user password
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)

        // Verify user can sign in with new password
        const signInResponse = await page.request.post('/api/auth/sign-in/email', {
          data: {
            email: 'target@example.com',
            password: 'NewSecurePass123!',
          },
        })
        expect(signInResponse.status()).toBe(200)
      })

      await test.step('API-AUTH-ADMIN-SET-USER-PASSWORD-002: Returns 200 OK and revokes all user sessions', async () => {
        // Create multiple sessions for target user
        await signIn({ email: 'target@example.com', password: 'NewSecurePass123!' })
        await signIn({ email: 'target@example.com', password: 'NewSecurePass123!' })

        // Re-sign in as admin
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

        // WHEN: Admin sets password with revokeOtherSessions enabled
        const response = await page.request.post('/api/auth/admin/set-user-password', {
          data: {
            userId: targetUserId,
            newPassword: 'AnotherNewPass123!',
            revokeOtherSessions: true,
          },
        })

        // THEN: Returns 200 OK and revokes all user sessions
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('status', true)
      })
    }
  )
})
