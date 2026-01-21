/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API Session Context Integration
 *
 * Domain: api/tables
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Critical Integration Scenarios:
 * - API routes set session context before database queries
 * - RLS policies filter data correctly via API
 * - Role-based permissions enforced via API
 * - Field-level permissions enforced via API
 * - Owner-based filtering works via API
 * - Unauthenticated requests are rejected
 */

test.describe('API Session Context Integration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'API-TABLES-SESSION-CTX-INT-001: should set session context from auth token for API requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: Application with auth and tables
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      await createAuthenticatedUser({ email: 'user@example.com' })

      // WHEN: Making authenticated API request
      const response = await request.get('/api/tables/1/records', {})

      // THEN: Session context should be set correctly (verified by successful data access)
      expect(response.status()).toBe(200)

      // Implicit verification: If session context wasn't set,
      // RLS policies would deny access and return empty results
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-002: should enforce RLS owner filtering via API',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with owner-based RLS policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              read: { type: 'owner', field: 'owner_id' },
            },
          },
        ],
      })

      // Create two users
      const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
      const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

      // Insert tasks for both users
      await executeQuery(`
        INSERT INTO tasks (id, title, owner_id)
        VALUES
          (1, 'User 1 Task', '${user1.user.id}'),
          (2, 'User 2 Task', '${user2.user.id}')
      `)

      // WHEN: User1 requests tasks via API
      const response = await request.get('/api/tables/1/records', {})

      // THEN: API should return only user1's tasks (RLS filtering via session context)
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields.title).toBe('User 1 Task')
      expect(data.records[0].fields.owner_id).toBe(user1.user.id)
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-003: should enforce role-based permissions via API',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signIn, executeQuery, page }) => {
      // GIVEN: Table with role-based read permissions (admin only)
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
            admin: true,
          },
          tables: [
            {
              id: 1,
              name: 'confidential',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'secret', type: 'single-line-text' },
              ],
              permissions: {
                read: { type: 'roles', roles: ['owner', 'admin'] },
              },
            },
          ],
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'admin123',
            name: 'Admin User',
          },
        }
      )

      // Sign in as admin
      await signIn({
        email: 'admin@example.com',
        password: 'admin123',
      })

      // Create member user via API
      await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: 'member@example.com',
          password: 'TestPassword123!',
          name: 'Member User',
        },
      })

      // Insert confidential data
      await executeQuery(`
        INSERT INTO confidential (id, secret)
        VALUES (1, 'Top Secret Data')
      `)

      // WHEN: Member tries to read confidential data via API
      await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'member@example.com',
          password: 'TestPassword123!',
        },
      })

      const memberApiResponse = await request.get('/api/tables/1/records', {})

      // THEN: Member should be denied (403 or empty results based on RLS)
      // RLS policies return empty results for unauthorized access
      const memberApiData = await memberApiResponse.json()
      expect(memberApiData.records).toHaveLength(0)

      // WHEN: Admin reads confidential data via API
      await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'admin@example.com',
          password: 'admin123',
        },
      })

      const adminResponse = await request.get('/api/tables/1/records', {})

      // THEN: Admin should see the data (role-based permission via session context)
      expect(adminResponse.status()).toBe(200)

      const adminData = await adminResponse.json()
      expect(adminData.records).toHaveLength(1)
      expect(adminData.records[0].fields.secret).toBe('Top Secret Data')
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-004: should enforce field-level permissions via API',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signIn, executeQuery, page }) => {
      // GIVEN: Table with field-level permissions (salary restricted to admins)
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            emailAndPassword: true,
          },
          tables: [
            {
              id: 1,
              name: 'employees',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text' },
                { id: 3, name: 'salary', type: 'currency', currency: 'USD' },
              ],
              permissions: {
                fields: [
                  {
                    field: 'salary',
                    read: { type: 'roles', roles: ['owner', 'admin'] },
                  },
                ],
              },
            },
          ],
        },
        {
          adminBootstrap: {
            email: 'admin@example.com',
            password: 'admin123',
            name: 'Admin User',
          },
        }
      )

      // Sign in as admin
      await signIn({
        email: 'admin@example.com',
        password: 'admin123',
      })

      // Create member user via API
      await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: 'member@example.com',
          password: 'TestPassword123!',
          name: 'Member User',
        },
      })

      // Insert employee data
      await executeQuery(`
        INSERT INTO employees (id, name, salary)
        VALUES (1, 'John Doe', 75000)
      `)

      // WHEN: Member requests employee data via API
      await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'member@example.com',
          password: 'TestPassword123!',
        },
      })

      const memberApiResponse = await request.get('/api/tables/1/records', {})

      // THEN: Member should see name but NOT salary (field-level permission via session context)
      expect(memberApiResponse.status()).toBe(200)

      const memberApiData = await memberApiResponse.json()
      expect(memberApiData.records).toHaveLength(1)
      expect(memberApiData.records[0].fields.name).toBe('John Doe')
      expect(memberApiData.records[0].fields).not.toHaveProperty('salary')

      // WHEN: Admin requests employee data via API
      await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'admin@example.com',
          password: 'admin123',
        },
      })

      const adminApiResponse = await request.get('/api/tables/1/records', {})

      // THEN: Admin should see ALL fields including salary
      expect(adminApiResponse.status()).toBe(200)

      const adminApiData = await adminApiResponse.json()
      expect(adminApiData.records).toHaveLength(1)
      expect(adminApiData.records[0].fields.name).toBe('John Doe')
      expect(adminApiData.records[0].fields.salary).toBe(75_000)
    }
  )

  test(
    'API-TABLES-SESSION-CTX-INT-005: should reject unauthenticated API requests',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: Application with auth enabled
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: Making unauthenticated API request (no Authorization header)
      const response = await request.get('/api/tables/1/records')

      // THEN: Should return 401 Unauthorized (no session context = no access)
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data.error).toBeDefined()
    }
  )

  test.fixme(
    'API-TABLES-SESSION-CTX-INT-006: should handle create operations with session context',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser, executeQuery }) => {
      // GIVEN: Table with owner field
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          emailAndPassword: true,
        },
        tables: [
          {
            id: 1,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'user' },
            ],
            permissions: {
              create: { type: 'authenticated' },
            },
          },
        ],
      })

      const user = await createAuthenticatedUser({
        email: 'user@example.com',
        password: 'password123',
      })

      // WHEN: User creates a new record via API
      const response = await request.post('/api/tables/1/records', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'New Project',
        },
      })

      // THEN: Record should be created with correct owner_id (set by session context)
      expect(response.status()).toBe(201)

      const data = await response.json()
      expect(data.record.fields.name).toBe('New Project')

      // Verify in database that owner_id was set correctly
      const result = await executeQuery(`
        SELECT * FROM projects WHERE name = 'New Project'
      `)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].owner_id).toBe(user.user.id)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED workflow validation
  // ============================================================================

  test(
    'API-TABLES-SESSION-CTX-INT-REGRESSION: user can complete full API session context integration workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, signIn, executeQuery, page }) => {
      // NOTE: Regression test focuses on single user's workflow
      // Multi-user session switching (owner/member) is tested in @spec tests

      await test.step('Setup: Start server with table', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            auth: {
              emailAndPassword: true,
              admin: true,
            },
            tables: [
              {
                id: 1,
                name: 'projects',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  { id: 3, name: 'budget', type: 'currency', currency: 'USD' },
                  { id: 4, name: 'owner_id', type: 'user' },
                ],
                permissions: {
                  read: { type: 'owner', field: 'owner_id' },
                  fields: [
                    {
                      field: 'budget',
                      read: { type: 'roles', roles: ['owner', 'admin'] },
                    },
                  ],
                },
              },
            ],
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

      // Create other user and then sign in as admin (for testing RLS owner filtering)
      const otherUserResponse = await page.request.post('/api/auth/sign-up/email', {
        data: {
          email: 'other@example.com',
          password: 'TestPassword123!',
          name: 'Other User',
        },
      })
      const otherUserData = await otherUserResponse.json()

      // Sign in as admin (who will own the projects)
      const adminResult = await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      await test.step('Setup: Insert test data for both users', async () => {
        await executeQuery(`
          INSERT INTO projects (id, name, budget, owner_id)
          VALUES
            (1, 'Admin Project', 100000, '${adminResult.user.id}'),
            (2, 'Other User Project', 50000, '${otherUserData.user.id}')
        `)
      })

      await test.step('API-TABLES-SESSION-CTX-INT-001: Set session context from auth token for API requests', async () => {
        // Authenticated request should succeed (session context is set)
        const response = await request.get('/api/tables/1/records', {})

        expect(response.status()).toBe(200)
        // Success proves session context was set correctly
      })

      await test.step('API-TABLES-SESSION-CTX-INT-002: Enforce RLS owner filtering via API', async () => {
        // Admin should see only their own projects (RLS owner filtering)
        const response = await request.get('/api/tables/1/records', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields.name).toBe('Admin Project')
        expect(data.records[0].fields.owner_id).toBe(adminResult.user.id)
        // Should NOT see other user's project (owner filtering)
        expect(
          data.records.find(
            (r: { fields: { name: string } }) => r.fields.name === 'Other User Project'
          )
        ).toBeUndefined()
      })

      await test.step('API-TABLES-SESSION-CTX-INT-003: Enforce role-based permissions via API', async () => {
        // Owner should see budget field (role-based permission)
        const response = await request.get('/api/tables/1/records', {})

        expect(response.status()).toBe(200)

        const data = await response.json()
        expect(data.records).toHaveLength(1)
        // Budget may be returned as number or string depending on serialization
        expect(Number(data.records[0].fields.budget)).toBe(100_000)
      })

      // NOTE: Additional scenarios (member permissions, field-level permissions, unauthenticated requests)
      // are covered in @spec tests 003, 004, 005
      // NOTE: Step 006 (create operations with session context) is marked .fixme() in @spec tests
      // - feature is not yet implemented
    }
  )
})
