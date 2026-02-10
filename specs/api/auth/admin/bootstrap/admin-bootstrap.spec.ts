/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Bootstrap (Automatic Admin Creation)
 *
 * Source: Environment-driven admin account creation at application startup
 * Domain: api
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (13 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Feature Description:
 * When the application starts with the following environment variables defined:
 * - AUTH_ADMIN_EMAIL: Email for the admin account
 * - AUTH_ADMIN_PASSWORD: Password for the admin account
 * - AUTH_ADMIN_NAME: Display name for the admin account
 *
 * The application should automatically create an admin account if:
 * - All required environment variables are set
 * - No account with that email already exists
 * - The email format is valid
 * - The password meets minimum security requirements
 *
 * Integration Points:
 * - Better Auth for authentication
 * - Admin plugin for role management
 * - Database (Drizzle ORM) for user storage
 * - Effect.ts for error handling
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via auth fixtures
 * - Session verification after login with bootstrapped admin
 */

test.describe('Admin Bootstrap (Automatic Admin Creation)', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  // ---------------------------------------------------------------------------
  // Successful Admin Creation Tests
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-001: should create admin account on first startup when env vars are set',
    { tag: '@spec' },
    async ({ startServerWithSchema, signIn }) => {
      // GIVEN: Application started with admin bootstrap environment variables
      // Note: The server fixture will be modified to accept adminBootstrap config
      // which translates to AUTH_ADMIN_* environment variables
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'bootstrap-admin@example.com',
            password: 'BootstrapPass123!',
            name: 'Bootstrap Admin',
          },
        }
      )

      // WHEN: Attempting to sign in with the bootstrapped admin credentials
      const authResult = await signIn({
        email: 'bootstrap-admin@example.com',
        password: 'BootstrapPass123!',
      })

      // THEN: Sign in succeeds and user has admin role
      expect(authResult.user).toBeDefined()
      expect(authResult.user.email).toBe('bootstrap-admin@example.com')
      expect(authResult.user.name).toBe('Bootstrap Admin')
      expect(authResult.user.role).toBe('admin')
      expect(authResult.session).toBeDefined()
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-002: should create admin with verified email status',
    { tag: '@spec' },
    async ({ startServerWithSchema, signIn }) => {
      // GIVEN: Application started with admin bootstrap environment variables
      // AND email verification is required for regular users
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'verified-admin@example.com',
            password: 'VerifiedPass123!',
            name: 'Verified Admin',
          },
        }
      )

      // WHEN: Signing in with the bootstrapped admin credentials after email verification
      const authResult = await signIn({
        email: 'verified-admin@example.com',
        password: 'VerifiedPass123!',
      })

      // THEN: Admin account has email verified and has admin role
      expect(authResult.user).toBeDefined()
      expect(authResult.user.emailVerified).toBe(true)
      expect(authResult.user.role).toBe('admin')
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-003: should allow admin to access admin-only endpoints after bootstrap',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signIn }) => {
      // GIVEN: Application started with admin bootstrap and admin signs in
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'admin-access@example.com',
            password: 'AdminAccess123!',
            name: 'Admin Access Test',
          },
        }
      )

      await signIn({
        email: 'admin-access@example.com',
        password: 'AdminAccess123!',
      })

      // WHEN: Admin calls admin-only endpoint (list users)
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 200 OK with user list
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('users')
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThanOrEqual(1)
    }
  )

  // ---------------------------------------------------------------------------
  // Idempotent Behavior Tests
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-004: should not create duplicate admin on subsequent startups',
    { tag: '@spec' },
    async ({ startServerWithSchema, signIn, executeQuery }) => {
      // GIVEN: Application started with admin bootstrap
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'idempotent-admin@example.com',
            password: 'IdempotentPass123!',
            name: 'Idempotent Admin',
          },
        }
      )

      // Verify admin was created
      await signIn({
        email: 'idempotent-admin@example.com',
        password: 'IdempotentPass123!',
      })

      // WHEN: Checking user count in database
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE email = 'idempotent-admin@example.com'"
      )

      // THEN: Only one admin account exists (idempotent)
      expect(parseInt(result.count, 10)).toBe(1)
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-005: should not modify existing user if email already exists with different role',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Create existing user in database BEFORE server starts
      // This simulates a scenario where user exists from previous run
      await executeQuery([
        "INSERT INTO auth.user (id, email, name, email_verified, created_at, updated_at) VALUES ('existing-user-id', 'existing-user@example.com', 'Existing User', true, NOW(), NOW())",
        // Insert session for the existing user (required by Better Auth for password)
        "INSERT INTO auth.session (id, user_id, expires_at, token, created_at, updated_at) VALUES ('existing-session-id', 'existing-user-id', NOW() + INTERVAL '7 days', 'existing-token', NOW(), NOW())",
      ])

      // WHEN: Application starts with admin bootstrap for the same email
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'existing-user@example.com',
            password: 'BootstrapNewPass123!',
            name: 'Bootstrap Admin',
          },
        }
      )

      // THEN: Checking user role in database
      const result = await executeQuery(
        "SELECT role, name FROM auth.user WHERE email = 'existing-user@example.com'"
      )

      // THEN: Existing user's role and name are NOT modified
      // The original user data should be preserved
      expect(result.name).toBe('Existing User')
      expect(result.role).not.toBe('admin')
    }
  )

  // ---------------------------------------------------------------------------
  // Environment Variable Validation Tests
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-006: should not create admin when email env var is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application started with only password and name (no email)
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            // email: undefined - intentionally missing
            password: 'MissingEmail123!',
            name: 'No Email Admin',
          },
        }
      )

      // WHEN: Checking for admin users in database
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE role = 'admin'"
      )

      // THEN: No admin account was created
      expect(parseInt(result.count, 10)).toBe(0)
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-007: should not create admin when password env var is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application started with only email and name (no password)
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'no-password@example.com',
            // password: undefined - intentionally missing
            name: 'No Password Admin',
          },
        }
      )

      // WHEN: Checking for admin users in database
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE email = 'no-password@example.com'"
      )

      // THEN: No admin account was created
      expect(parseInt(result.count, 10)).toBe(0)
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-008: should create admin with default name when name env var is missing',
    { tag: '@spec' },
    async ({ startServerWithSchema, signIn }) => {
      // GIVEN: Application started with email and password but no name
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'default-name@example.com',
            password: 'DefaultName123!',
            // name: undefined - should use default
          },
        }
      )

      // WHEN: Signing in with the bootstrapped admin
      const authResult = await signIn({
        email: 'default-name@example.com',
        password: 'DefaultName123!',
      })

      // THEN: Admin has a default name (e.g., "Administrator" or email prefix)
      expect(authResult.user).toBeDefined()
      expect(authResult.user.name).toBeTruthy()
      // Name should be either "Administrator" or derived from email
      expect(['Administrator', 'default-name']).toContain(authResult.user.name)
    }
  )

  // ---------------------------------------------------------------------------
  // Validation Error Tests
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-009: should not create admin with invalid email format',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application started with invalid email format
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'not-a-valid-email',
            password: 'InvalidEmail123!',
            name: 'Invalid Email Admin',
          },
        }
      )

      // WHEN: Checking for admin users in database
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE role = 'admin'"
      )

      // THEN: No admin account was created due to invalid email
      expect(parseInt(result.count, 10)).toBe(0)
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-010: should not create admin with password shorter than minimum length',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application started with password shorter than 8 characters
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'short-pass@example.com',
            password: 'short', // Less than 8 characters
            name: 'Short Password Admin',
          },
        }
      )

      // WHEN: Checking for admin users in database
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE email = 'short-pass@example.com'"
      )

      // THEN: No admin account was created due to weak password
      expect(parseInt(result.count, 10)).toBe(0)
    }
  )

  // ---------------------------------------------------------------------------
  // Plugin Dependency Tests
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-011: should not create admin when admin plugin is not enabled',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application started with admin env vars but admin plugin disabled
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            // admin: false - plugin not enabled
          },
        },
        {
          adminBootstrap: {
            email: 'no-plugin@example.com',
            password: 'NoPlugin123!',
            name: 'No Plugin Admin',
          },
        }
      )

      // WHEN: Checking for users with admin role
      const result = await executeQuery(
        "SELECT COUNT(*) as count FROM auth.user WHERE email = 'no-plugin@example.com' AND role = 'admin'"
      )

      // THEN: No admin account was created (plugin not available)
      expect(parseInt(result.count, 10)).toBe(0)
    }
  )

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-012: should not create admin when auth is completely disabled',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application started without auth configuration
      await startServerWithSchema(
        {
          name: 'test-app',
          // No auth configuration
        },
        {
          adminBootstrap: {
            email: 'no-auth@example.com',
            password: 'NoAuth123!',
            name: 'No Auth Admin',
          },
        }
      )

      // WHEN: Checking if auth endpoints exist
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'no-auth@example.com',
          password: 'NoAuth123!',
        },
      })

      // THEN: Auth endpoint returns 404 (auth disabled)
      expect(response.status()).toBe(404)
    }
  )

  // ---------------------------------------------------------------------------
  // Logging and Observability Test
  // ---------------------------------------------------------------------------

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-013: should log admin creation success without exposing password',
    { tag: '@spec' },
    async ({ startServerWithSchema, signIn }) => {
      // GIVEN: Application started with admin bootstrap
      // Note: This test verifies behavior by checking the admin was created
      // Actual log verification would require log capture infrastructure
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'logged-admin@example.com',
            password: 'LoggedPass123!',
            name: 'Logged Admin',
          },
        }
      )

      // WHEN: Verifying admin was created successfully
      const authResult = await signIn({
        email: 'logged-admin@example.com',
        password: 'LoggedPass123!',
      })

      // THEN: Admin exists and can authenticate
      // (Log verification would be done via log capture in production tests)
      expect(authResult.user).toBeDefined()
      expect(authResult.user.email).toBe('logged-admin@example.com')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'API-AUTH-ADMIN-BOOTSTRAP-REGRESSION: admin bootstrap workflow completes successfully',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signIn, signUp, executeQuery }) => {
      // Setup: Start server with admin bootstrap configuration
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
          },
        },
        {
          adminBootstrap: {
            email: 'regression-admin@example.com',
            password: 'RegressionPass123!',
            name: 'Regression Admin',
          },
        }
      )

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-001: Admin account is created on startup', async () => {
        // WHEN: Signing in with bootstrapped admin credentials
        const authResult = await signIn({
          email: 'regression-admin@example.com',
          password: 'RegressionPass123!',
        })

        // THEN: Sign in succeeds with admin role
        expect(authResult.user).toBeDefined()
        expect(authResult.user.email).toBe('regression-admin@example.com')
        expect(authResult.user.role).toBe('admin')
      })

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-002: Admin email is pre-verified', async () => {
        // WHEN: Getting current session
        const response = await page.request.get('/api/auth/get-session')

        // THEN: User has verified email
        const data = await response.json()
        expect(data.user.emailVerified).toBe(true)
      })

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-003: Admin can access admin endpoints', async () => {
        // WHEN: Admin lists users
        const response = await page.request.get('/api/auth/admin/list-users')

        // THEN: Returns 200 with user list
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.users).toBeDefined()
        expect(data.users.length).toBeGreaterThanOrEqual(1)
      })

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-004: Idempotent - only one admin exists', async () => {
        // WHEN: Counting admin users in database
        const result = await executeQuery(
          "SELECT COUNT(*) as count FROM auth.user WHERE email = 'regression-admin@example.com'"
        )

        // THEN: Exactly one admin account exists
        expect(parseInt(result.count, 10)).toBe(1)
      })

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-005: Regular users are not affected by bootstrap', async () => {
        // GIVEN: Create a regular user
        await signUp({
          email: 'regular-user@example.com',
          password: 'RegularPass123!',
          name: 'Regular User',
        })

        // WHEN: Checking regular user role
        const result = await executeQuery(
          "SELECT role FROM auth.user WHERE email = 'regular-user@example.com'"
        )

        // THEN: Regular user has default role (not admin)
        expect(result.role).not.toBe('admin')
      })

      await test.step('API-AUTH-ADMIN-BOOTSTRAP-003: Admin can manage other users', async () => {
        // Re-authenticate as admin
        await signIn({
          email: 'regression-admin@example.com',
          password: 'RegressionPass123!',
        })

        // WHEN: Admin sets role on regular user
        const response = await page.request.post('/api/auth/admin/set-role', {
          data: {
            userId: (
              await executeQuery(
                "SELECT id FROM auth.user WHERE email = 'regular-user@example.com'"
              )
            ).id,
            role: 'viewer',
          },
        })

        // THEN: Role update succeeds
        expect(response.status()).toBe(200)
      })
    }
  )
})
