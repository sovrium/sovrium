/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Get user by ID
 *
 * Source: specs/api/paths/auth/admin/get-user/get.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
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

test.describe('Admin: Get user by ID', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test(
    'API-AUTH-ADMIN-GET-USER-001: should return 200 OK with user details',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn, signUp }) => {
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
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // Sign back in as admin (signUp auto-signs in as new user)
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // WHEN: Admin requests user details by ID
      const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUser.user.id}`)

      // DEBUG: Log response for troubleshooting
      if (response.status() !== 200) {
        const errorBody = await response.text()
        console.log(
          `DEBUG: id=${targetUser.user.id}, status=${response.status()}, body=${errorBody}`
        )
      }

      // THEN: Returns 200 OK with user details
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('id', targetUser.user.id)
      expect(data).toHaveProperty('email', 'target@example.com')
      expect(data).toHaveProperty('name', 'Target User')
    }
  )

  test(
    'API-AUTH-ADMIN-GET-USER-002: should return 400 Bad Request without userId parameter',
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

      // WHEN: Admin requests user without userId parameter
      const response = await page.request.get('/api/auth/admin/get-user')

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-GET-USER-003: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
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

      // WHEN: Unauthenticated user attempts to get user
      const response = await page.request.get('/api/auth/admin/get-user?id=2')

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ADMIN-GET-USER-004: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated regular user (non-admin)
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

      // WHEN: Regular user attempts to get another user's details
      const response = await page.request.get('/api/auth/admin/get-user?id=2')

      // THEN: Returns 403 Forbidden (authorization failure)
      // Note: Better Auth returns 403 for authorization failures (authenticated but not admin)
      expect(response.status()).toBe(403)
    }
  )

  test(
    'API-AUTH-ADMIN-GET-USER-005: should return 404 Not Found for non-existent user',
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

      // WHEN: Admin requests user with non-existent ID
      const response = await page.request.get('/api/auth/admin/get-user?id=999')

      // THEN: Returns 404 Not Found
      // Note: Better Auth returns 404 for non-existent resources
      expect(response.status()).toBe(404)
    }
  )

  test(
    'API-AUTH-ADMIN-GET-USER-006: should return 200 OK with password field excluded',
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

      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })
      const targetUser = await signUp({
        email: 'target@example.com',
        password: 'TargetPass123!',
        name: 'Target User',
      })

      // Sign back in as admin (signUp auto-signs in as new user)
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      // WHEN: Admin requests user details
      const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUser.user.id}`)

      // THEN: Returns 200 OK with password field excluded for security
      expect(response.status()).toBe(200)

      const data = await response.json()
      // Password should not be exposed
      expect(data).not.toHaveProperty('password')
      expect(data).not.toHaveProperty('password_hash')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-GET-USER-REGRESSION: admin can complete full get-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn, signOut }) => {
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

      await test.step('Setup: Create target user for testing', async () => {
        // Create target user and capture ID
        const targetUser = await signUp({
          email: 'target@example.com',
          password: 'TargetPass123!',
          name: 'Target User',
        })
        targetUserId = targetUser.user.id
      })

      await test.step('API-AUTH-ADMIN-GET-USER-003: Returns 401 Unauthorized without authentication', async () => {
        // Sign out to become unauthenticated (setup signUp auto-signed in as target user)
        await signOut()

        // WHEN: Unauthenticated user attempts to get user
        const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUserId}`)

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      await test.step('API-AUTH-ADMIN-GET-USER-002: Returns 400 Bad Request without userId parameter', async () => {
        // Sign in as admin for this test
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

        // WHEN: Admin requests user without userId parameter
        const response = await page.request.get('/api/auth/admin/get-user')

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-GET-USER-004: Returns 403 Forbidden for non-admin user', async () => {
        // Create and sign in as regular user
        await signUp({
          email: 'regular@example.com',
          password: 'RegularPass123!',
          name: 'Regular User',
        })
        await signIn({ email: 'regular@example.com', password: 'RegularPass123!' })

        // WHEN: Regular user attempts to get another user's details
        const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUserId}`)

        // THEN: Returns 403 Forbidden (authorization failure)
        // Note: Better Auth returns 403 for authorization failures (authenticated but not admin)
        expect(response.status()).toBe(403)
      })

      await test.step('API-AUTH-ADMIN-GET-USER-005: Returns 404 Not Found for non-existent user', async () => {
        // Sign in as admin
        await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

        // WHEN: Admin requests user with non-existent ID
        const response = await page.request.get('/api/auth/admin/get-user?id=999')

        // THEN: Returns 404 Not Found
        // Note: Better Auth returns 404 for non-existent resources
        expect(response.status()).toBe(404)
      })

      await test.step('API-AUTH-ADMIN-GET-USER-001: Returns 200 OK with user details', async () => {
        // WHEN: Admin requests user details by ID
        const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUserId}`)

        // THEN: Returns 200 OK with user details
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('id', targetUserId)
        expect(data).toHaveProperty('email', 'target@example.com')
        expect(data).toHaveProperty('name', 'Target User')
      })

      await test.step('API-AUTH-ADMIN-GET-USER-006: Returns 200 OK with password field excluded', async () => {
        // WHEN: Admin requests user details
        const response = await page.request.get(`/api/auth/admin/get-user?id=${targetUserId}`)

        // THEN: Returns 200 OK with password field excluded for security
        expect(response.status()).toBe(200)

        const data = await response.json()
        // Password should not be exposed
        expect(data).not.toHaveProperty('password')
        expect(data).not.toHaveProperty('password_hash')
      })
    }
  )
})
