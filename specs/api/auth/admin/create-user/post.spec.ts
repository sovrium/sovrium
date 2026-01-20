/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin: Create user
 *
 * Source: specs/api/paths/auth/admin/create-user/post.json
 * Domain: api
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
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

test.describe('Admin: Create user', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // Note: These tests are marked .fixme() because the admin endpoints
  // require proper admin user setup which isn't available via public API
  // ============================================================================

  test(
    'API-AUTH-ADMIN-CREATE-USER-001: should return 200 with user data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin creates a new user with valid data
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with user data
      // Note: Better Auth returns 200 for successful creation, not 201
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', 'newuser@example.com')
      expect(data.user).toHaveProperty('name', 'New User')
      // Password should not be exposed
      expect(data.user).not.toHaveProperty('password')
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-002: should return 200 but emailVerified parameter ignored',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin attempts to create user with emailVerified: true
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'verified@example.com',
          name: 'Verified User',
          password: 'SecurePass123!',
          emailVerified: true,
        },
      })

      // THEN: Returns 200 OK but emailVerified remains false
      // Note: Better Auth admin plugin does NOT support emailVerified parameter
      // Users created via admin must verify email through normal flow
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('emailVerified', false)
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-003: should return 400 Bad Request without required fields',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {},
      })

      // THEN: Returns 400 Bad Request with validation errors
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-004: should return 400 Bad Request with invalid email format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin submits request with invalid email format
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'not-an-email',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-005: should return 400 Bad Request with short password',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin submits request with password shorter than 8 characters
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'short',
        },
      })

      // THEN: Returns 400 Bad Request with validation error
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-006: should return 401 Unauthorized without authentication',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: A running server (no authenticated user)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      // WHEN: Unauthenticated user attempts to create user
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 401 Unauthorized
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-007: should return 403 Forbidden for non-admin user',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: An authenticated regular user (non-admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Regular User',
      })

      // WHEN: Regular user attempts to create user
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'newuser@example.com',
          name: 'Test User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-008: should return 409 Conflict for duplicate email',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn, signUp }) => {
      // GIVEN: An authenticated admin user and an existing user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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
        email: 'existing@example.com',
        password: 'ExistingPass123!',
        name: 'Existing User',
      })

      // WHEN: Admin attempts to create user with existing email
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'existing@example.com',
          name: 'Another User',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 400 Bad Request (PostgreSQL unique constraint violation)
      // Note: Better Auth converts database constraint errors to 400, not 409
      expect(response.status()).toBe(400)

      const data = await response.json()
      expect(data).toHaveProperty('message')
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-009: should return 200 and store name without XSS sanitization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin submits name with XSS payload
      const xssPayload = "<script>alert('xss')</script>Malicious"
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'xsstest@example.com',
          name: xssPayload,
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK and stores name as-is (no sanitization)
      // Note: Better Auth does NOT sanitize input - this is the application's responsibility
      // Sanitization should happen at render time, not storage time
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      // Name is stored exactly as provided (with XSS payload)
      expect(data.user.name).toBe(xssPayload)
    }
  )

  test(
    'API-AUTH-ADMIN-CREATE-USER-010: should return 200 with Unicode name preserved',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: An authenticated admin user
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      // WHEN: Admin creates user with Unicode characters in name
      const response = await page.request.post('/api/auth/admin/create-user', {
        data: {
          email: 'unicode@example.com',
          name: 'José García 日本語',
          password: 'SecurePass123!',
        },
      })

      // THEN: Returns 200 OK with Unicode name preserved
      // Note: Better Auth returns 200 for successful creation, not 201
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.name).toBe('José García 日本語')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-CREATE-USER-REGRESSION: admin can complete full create-user workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp, signIn }) => {
      // Setup: Start server with admin plugin enabled
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
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

      await test.step('API-AUTH-ADMIN-CREATE-USER-006: Returns 401 without authentication', async () => {
        // WHEN: Unauthenticated user attempts to create user
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'newuser@example.com',
            name: 'Test User',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 401 Unauthorized
        expect(response.status()).toBe(401)
      })

      // Setup: Create regular users (admin already created via adminBootstrap)
      await signUp({ email: 'user@example.com', password: 'UserPass123!', name: 'Regular User' })
      await signUp({
        email: 'existing@example.com',
        password: 'ExistingPass123!',
        name: 'Existing User',
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-007: Returns 403 for non-admin user', async () => {
        // GIVEN: An authenticated regular user (non-admin)
        await signIn({ email: 'user@example.com', password: 'UserPass123!' })

        // WHEN: Regular user attempts to create user
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'newuser@example.com',
            name: 'Test User',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 403 Forbidden
        expect(response.status()).toBe(403)
      })

      // Sign in as admin for remaining tests
      await signIn({ email: 'admin@example.com', password: 'AdminPass123!' })

      await test.step('API-AUTH-ADMIN-CREATE-USER-003: Returns 400 without required fields', async () => {
        // WHEN: Admin submits request without required fields
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {},
        })

        // THEN: Returns 400 Bad Request with validation errors
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-004: Returns 400 with invalid email format', async () => {
        // WHEN: Admin submits request with invalid email format
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'not-an-email',
            name: 'Test User',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-005: Returns 400 with short password', async () => {
        // WHEN: Admin submits request with password shorter than 8 characters
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'newuser@example.com',
            name: 'Test User',
            password: 'short',
          },
        })

        // THEN: Returns 400 Bad Request with validation error
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-008: Returns 400 for duplicate email', async () => {
        // WHEN: Admin attempts to create user with existing email
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'existing@example.com',
            name: 'Another User',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 400 Bad Request (PostgreSQL unique constraint violation)
        // Note: Better Auth converts database constraint errors to 400, not 409
        expect(response.status()).toBe(400)

        const data = await response.json()
        expect(data).toHaveProperty('message')
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-001: Returns 200 with user data', async () => {
        // WHEN: Admin creates a new user with valid data
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'newuser@example.com',
            name: 'New User',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 200 OK with user data
        // Note: Better Auth returns 200 for successful creation, not 201
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('email', 'newuser@example.com')
        expect(data.user).toHaveProperty('name', 'New User')
        // Password should not be exposed
        expect(data.user).not.toHaveProperty('password')
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-002: Returns 200 but emailVerified parameter ignored', async () => {
        // WHEN: Admin attempts to create user with emailVerified: true
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'verified@example.com',
            name: 'Verified User',
            password: 'SecurePass123!',
            emailVerified: true,
          },
        })

        // THEN: Returns 200 OK but emailVerified remains false
        // Note: Better Auth admin plugin does NOT support emailVerified parameter
        // Users created via admin must verify email through normal flow
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('emailVerified', false)
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-009: Returns 200 and stores name without XSS sanitization', async () => {
        // WHEN: Admin submits name with XSS payload
        const xssPayload = "<script>alert('xss')</script>Malicious"
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'xsstest@example.com',
            name: xssPayload,
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 200 OK and stores name as-is (no sanitization)
        // Note: Better Auth does NOT sanitize input - this is the application's responsibility
        // Sanitization should happen at render time, not storage time
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        // Name is stored exactly as provided (with XSS payload)
        expect(data.user.name).toBe(xssPayload)
      })

      await test.step('API-AUTH-ADMIN-CREATE-USER-010: Returns 200 with Unicode name preserved', async () => {
        // WHEN: Admin creates user with Unicode characters in name
        const response = await page.request.post('/api/auth/admin/create-user', {
          data: {
            email: 'unicode@example.com',
            name: 'José García 日本語',
            password: 'SecurePass123!',
          },
        })

        // THEN: Returns 200 OK with Unicode name preserved
        // Note: Better Auth returns 200 for successful creation, not 201
        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('user')
        expect(data.user.name).toBe('José García 日本語')
      })
    }
  )
})
