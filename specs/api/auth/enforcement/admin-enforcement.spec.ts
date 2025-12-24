/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Admin Permission Enforcement
 *
 * Domain: api/auth
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - API response assertions (status codes, response schemas)
 * - Database state validation via API (no direct executeQuery for auth data)
 * - Authentication/authorization checks via auth fixtures
 *
 * Permission Enforcement Scenarios:
 * - Admin-only endpoint protection
 * - Non-admin access denial
 * - Role elevation prevention
 * - Session token validation
 */

test.describe('Admin Permission Enforcement', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'API-AUTH-ENFORCE-ADMIN-001: should deny access to all admin endpoints for unauthenticated users',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with admin plugin enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      // WHEN: Unauthenticated user accesses admin endpoints
      // THEN: All requests return 401 Unauthorized

      const adminEndpoints = [
        { method: 'GET', path: '/api/auth/admin/list-users' },
        { method: 'GET', path: '/api/auth/admin/get-user/123' },
        { method: 'POST', path: '/api/auth/admin/create-user' },
        { method: 'POST', path: '/api/auth/admin/ban-user' },
        { method: 'POST', path: '/api/auth/admin/unban-user' },
        { method: 'POST', path: '/api/auth/admin/set-role' },
      ]

      for (const endpoint of adminEndpoints) {
        const response =
          endpoint.method === 'GET'
            ? await page.request.get(endpoint.path)
            : await page.request.post(endpoint.path, { data: {} })

        expect(response.status()).toBe(401)
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-002: should deny access to admin endpoints for regular users',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Authenticated regular user (role: user)
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

      // WHEN: Regular user accesses admin endpoints
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Returns 403 Forbidden
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-003: should allow admin access to all admin endpoints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Authenticated admin user
      // Note: This test assumes first user can be promoted to admin via some mechanism
      // or that admin features have a way to set up the first admin
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      // WHEN: Admin accesses admin endpoints
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Request succeeds with 200
      expect(response.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-004: should prevent regular users from elevating their own role',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Regular user attempting to become admin
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

      // WHEN: User attempts to set their own role to admin
      const response = await page.request.post('/api/auth/admin/set-role', {
        data: { userId: '1', role: 'admin' },
      })

      // THEN: Request denied with 403
      expect(response.status()).toBe(403)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-005: should reject expired session tokens',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server with admin plugin
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      // WHEN: Using expired/invalid token
      const response = await page.request.get('/api/auth/admin/list-users', {
        headers: { Authorization: 'Bearer expired_token' },
      })

      // THEN: Request denied with 401
      expect(response.status()).toBe(401)
    }
  )

  test(
    'API-AUTH-ENFORCE-ADMIN-006: should reject invalid/malformed session tokens',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Server running
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      // WHEN: Using invalid tokens
      const invalidTokens = [
        'invalid_token_12345',
        '',
        'Bearer',
        'null',
        'undefined',
        '<script>alert(1)</script>',
        "'; DROP TABLE sessions; --",
      ]

      for (const token of invalidTokens) {
        const response = await page.request.get('/api/auth/admin/list-users', {
          headers: { Authorization: `Bearer ${token}` },
        })

        // THEN: All invalid tokens return 401
        expect(response.status()).toBe(401)
      }
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-007: should prevent banned admin from accessing admin endpoints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Admin user who gets banned
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      // Create admin user
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      // Create another admin who will ban the first
      await signUp({
        email: 'superadmin@example.com',
        password: 'SuperAdminPass123!',
        name: 'Super Admin',
      })

      // Ban the first admin
      await page.request.post('/api/auth/admin/ban-user', {
        data: { userId: '1', banReason: 'Policy violation' },
      })

      // Sign in as banned admin
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'admin@example.com',
          password: 'AdminPass123!',
        },
      })

      // WHEN: Banned admin attempts to access endpoints
      // THEN: Access denied - either can't sign in or can't access admin endpoints
      expect([401, 403]).toContain(signInResponse.status())
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-008: should enforce rate limiting on admin endpoints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp }) => {
      // GIVEN: Admin user making many requests
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
      })

      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      // WHEN: Exceeding rate limit
      const requests = []
      for (let i = 0; i < 100; i++) {
        requests.push(page.request.get('/api/auth/admin/list-users'))
      }

      const responses = await Promise.all(requests)

      // THEN: Some requests rate limited (429)
      const rateLimited = responses.filter((r) => r.status() === 429)
      expect(rateLimited.length).toBeGreaterThan(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  // ============================================================================
  // Dual-Layer Permission Tests (Better Auth + RLS)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-009: should demonstrate early rejection pattern (Better Auth blocks before RLS check)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, signUp, executeQuery }) => {
      // GIVEN: Application with admin-only endpoints and database tables
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
        },
        tables: [
          {
            id: 1,
            name: 'admin_logs',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'action', type: 'single-line-text' },
              { id: 3, name: 'admin_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['admin'] }, // RLS layer permission
            },
          },
        ],
      })

      // Insert test data
      await executeQuery(["INSERT INTO admin_logs (action, admin_id) VALUES ('Test Action', '1')"])

      // Create regular user
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Regular User',
      })

      // WHEN: Regular user attempts to access admin endpoint
      const response = await page.request.get('/api/auth/admin/list-users')

      // THEN: Better Auth blocks at API level (before RLS check)
      expect(response.status()).toBe(403)

      // THEN: RLS never executes (verified by checking no database query logged)
      // Better Auth's early rejection prevents database access entirely
      const dbLogs = await executeQuery('SELECT COUNT(*) as count FROM admin_logs')
      expect(parseInt(dbLogs.rows[0].count)).toBe(1) // Only initial insert, no new queries

      // WHEN: Admin user attempts to access admin endpoint
      await signUp({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
      })

      const adminResponse = await page.request.get('/api/auth/admin/list-users')

      // THEN: Better Auth allows → request proceeds to database (RLS would execute if needed)
      expect(adminResponse.status()).toBe(200)
    }
  )

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-010: should enforce complementary admin permissions (Better Auth guards endpoint → RLS filters data)',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      signUp,
      signIn,
      executeQuery,
      createAuthenticatedUser,
    }) => {
      // GIVEN: Application with admin plugin and organization-scoped admin data
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
          admin: true,
          organization: true,
        },
        tables: [
          {
            id: 1,
            name: 'admin_settings',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'setting_key', type: 'single-line-text' },
              { id: 3, name: 'setting_value', type: 'single-line-text' },
              { id: 4, name: 'organization_id', type: 'single-line-text' },
            ],
            permissions: {
              read: { type: 'roles', roles: ['admin'] }, // Better Auth: admin-only
              organizationScoped: true, // RLS: organization isolation
            },
          },
        ],
      })

      // Create two organizations with admins
      await createAuthenticatedUser({ email: 'admin1@example.com' })
      await createAuthenticatedUser({ email: 'admin2@example.com' })

      const org1 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org 1' },
      })
      const org1Data = await org1.json()

      await signIn({ email: 'admin2@example.com', password: 'AdminPass123!' })

      const org2 = await page.request.post('/api/auth/organization/create', {
        data: { name: 'Org 2' },
      })
      const org2Data = await org2.json()

      // Insert settings for each organization
      await executeQuery([
        `INSERT INTO admin_settings (setting_key, setting_value, organization_id) VALUES
         ('setting1', 'Org 1 Value', '${org1Data.organization.id}'),
         ('setting2', 'Org 2 Value', '${org2Data.organization.id}')`,
      ])

      // WHEN: Non-admin attempts to access admin settings
      await signUp({
        email: 'user@example.com',
        password: 'UserPass123!',
        name: 'Regular User',
      })

      const userResponse = await page.request.get('/api/tables/admin_settings/records')

      // THEN: Better Auth blocks at API level (not admin)
      expect([403, 401]).toContain(userResponse.status())

      // WHEN: Admin1 attempts to access admin settings
      await signIn({ email: 'admin1@example.com', password: 'AdminPass123!' })

      const admin1Response = await page.request.get('/api/tables/admin_settings/records')

      // THEN: Better Auth allows (is admin) → RLS filters by organization
      expect(admin1Response.status()).toBe(200)

      const admin1Data = await admin1Response.json()
      expect(admin1Data.records).toHaveLength(1) // Only Org 1 settings visible
      expect(admin1Data.records[0].organization_id).toBe(org1Data.organization.id)
      expect(admin1Data.records[0].setting_value).toBe('Org 1 Value')

      // WHEN: Admin2 attempts to access admin settings
      await signIn({ email: 'admin2@example.com', password: 'AdminPass123!' })

      const admin2Response = await page.request.get('/api/tables/admin_settings/records')

      // THEN: Better Auth allows (is admin) → RLS filters by organization
      expect(admin2Response.status()).toBe(200)

      const admin2Data = await admin2Response.json()
      expect(admin2Data.records).toHaveLength(1) // Only Org 2 settings visible
      expect(admin2Data.records[0].organization_id).toBe(org2Data.organization.id)
      expect(admin2Data.records[0].setting_value).toBe('Org 2 Value')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'API-AUTH-ENFORCE-ADMIN-011: admin permission enforcement workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, signUp }) => {
      await test.step('Setup: Start server with admin plugin', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
          },
        })
      })

      await test.step('Verify unauthenticated access fails', async () => {
        const unauthResponse = await page.request.get('/api/auth/admin/list-users')
        expect(unauthResponse.status()).toBe(401)
      })

      await test.step('Create regular user', async () => {
        await signUp({
          email: 'user@example.com',
          password: 'UserPass123!',
          name: 'Regular User',
        })
      })

      await test.step('Verify regular user access fails', async () => {
        const userResponse = await page.request.get('/api/auth/admin/list-users')
        expect(userResponse.status()).toBe(403)
      })

      await test.step('Create admin user', async () => {
        await signUp({
          email: 'admin@example.com',
          password: 'AdminPass123!',
          name: 'Admin User',
        })
      })

      await test.step('Verify admin access succeeds', async () => {
        const adminResponse = await page.request.get('/api/auth/admin/list-users')
        expect(adminResponse.status()).toBe(200)
      })
    }
  )
})
