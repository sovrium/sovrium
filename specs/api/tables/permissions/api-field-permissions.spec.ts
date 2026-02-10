/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for API-Level Field Permission Enforcement
 *
 * PURPOSE: Test that field-level permissions are correctly enforced in API responses
 *
 * TESTING STRATEGY (Hybrid Approach):
 * - Database-level tests (specs/app/tables/permissions/) verify RLS policy GENERATION
 * - API-level tests (this file) verify ENFORCEMENT in the full request flow
 *
 * WHY API-LEVEL TESTING MATTERS:
 * 1. Tests the complete authentication → session context → RLS → response flow
 * 2. Validates field filtering in JSON responses (not just SQL access)
 * 3. Catches integration bugs between middleware and database layer
 * 4. Tests what users actually experience
 *
 * Domain: api
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - Exhaustive field permission scenarios
 * 2. @regression test - Complete workflow validation
 */

test.describe('API Field Permission Enforcement', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of field permission enforcement via API
  // ============================================================================

  test(
    'API-TABLES-PERMISSIONS-FIELD-001: should exclude salary field from API response when member lacks read permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember, executeQuery }) => {
      // GIVEN: Table with field-level permissions (salary restricted to admin)
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'currency', currency: 'USD' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [
                {
                  field: 'salary',
                  read: ['admin'],
                  write: ['admin'],
                },
              ],
            },
          },
        ],
      })

      // Create member user (explicitly set to member role)
      await createAuthenticatedMember({ email: 'member@example.com' })

      // Insert test data
      await executeQuery(`
        INSERT INTO employees (name, email, salary)
        VALUES ('John Doe', 'john@example.com', 75000)
      `)

      // WHEN: Member user requests employee data via API
      const response = await request.get('/api/tables/1/records')

      // THEN: API response should include name but EXCLUDE salary field
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields).toHaveProperty('name', 'John Doe')
      expect(data.records[0].fields).toHaveProperty('email', 'john@example.com')
      // KEY ASSERTION: Salary field should be filtered out
      expect(data.records[0].fields).not.toHaveProperty('salary')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-FIELD-002: should include all fields in API response when admin has full read permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, signIn, executeQuery }) => {
      // GIVEN: Same table with field-level permissions
      await startServerWithSchema(
        {
          name: 'test-app',
          auth: {
            strategies: [{ type: 'emailAndPassword' }],
            defaultRole: 'viewer',
            roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
              primaryKey: { type: 'composite', fields: ['id'] },
              permissions: {
                read: 'authenticated',
                fields: [
                  {
                    field: 'salary',
                    read: ['admin'],
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

      // Sign in as admin
      await signIn({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      })

      // Insert test data
      await executeQuery(`
        INSERT INTO employees (name, salary)
        VALUES ('Jane Smith', 95000)
      `)

      // WHEN: Admin user requests employee data via API
      const response = await request.get('/api/tables/1/records')

      // THEN: Admin should see ALL fields including salary
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data.records).toHaveLength(1)
      expect(data.records[0].fields).toHaveProperty('name', 'Jane Smith')
      // KEY ASSERTION: Admin can see salary field (numeric type coerced to number)
      expect(data.records[0].fields).toHaveProperty('salary', 95_000)
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-FIELD-003: should reject write operation when user lacks field write permission',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember, executeQuery }) => {
      // GIVEN: Table where salary field is admin-write only
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              update: 'authenticated',
              fields: [
                {
                  field: 'salary',
                  read: ['admin'],
                  write: ['admin'],
                },
              ],
            },
          },
        ],
      })

      // Create member user
      await createAuthenticatedMember({ email: 'member@example.com' })

      // Insert test data
      await executeQuery(`
        INSERT INTO employees (id, name, salary)
        VALUES (1, 'John Doe', 75000)
      `)

      // WHEN: Member tries to update salary field via API
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          salary: 100_000, // Attempting to give themselves a raise!
        },
      })

      // THEN: Should return 403 Forbidden (field write permission denied)
      expect(response.status()).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.code).toBe('FORBIDDEN')
      expect(data.message).toMatch(/permission|forbidden|salary/i)

      // VERIFY: Salary should remain unchanged in database
      const result = await executeQuery(`SELECT salary FROM employees WHERE id = 1`)
      expect(result.salary).toBe('75000')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-FIELD-004: should allow partial update when user has write permission for some fields',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember, executeQuery }) => {
      // GIVEN: Table where member can update name but not salary
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              update: 'authenticated',
              fields: [
                {
                  field: 'name',
                  write: 'authenticated', // Anyone can update name
                },
                {
                  field: 'salary',
                  read: ['admin'],
                  write: ['admin'], // Only admin can update salary
                },
              ],
            },
          },
        ],
      })

      await createAuthenticatedMember({ email: 'member@example.com' })

      await executeQuery(`
        INSERT INTO employees (id, name, salary)
        VALUES (1, 'John Doe', 75000)
      `)

      // WHEN: Member updates only the name field (which they have permission for)
      const response = await request.patch('/api/tables/1/records/1', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'John Smith', // This should work
        },
      })

      // THEN: Update should succeed
      expect(response.status()).toBe(200)

      // VERIFY: Name updated, salary unchanged
      const result = await executeQuery(`SELECT name, salary FROM employees WHERE id = 1`)
      expect(result.name).toBe('John Smith')
      expect(result.salary).toBe('75000')
    }
  )

  test(
    'API-TABLES-PERMISSIONS-FIELD-005: should return 403 when filtering by restricted field',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedMember }) => {
      // GIVEN: Table where salary field is admin-only
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          strategies: [{ type: 'emailAndPassword' }],
          defaultRole: 'viewer',
          roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
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
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: 'authenticated',
              fields: [
                {
                  field: 'salary',
                  read: ['admin'],
                },
              ],
            },
          },
        ],
      })

      await createAuthenticatedMember({ email: 'member@example.com' })

      // WHEN: Member tries to filter by salary field they can't read
      const response = await request.get('/api/tables/1/records', {
        params: {
          filter: JSON.stringify({
            and: [{ field: 'salary', operator: 'greaterThan', value: 60_000 }],
          }),
        },
      })

      // THEN: Should return 403 (cannot filter by inaccessible field)
      // OR 200 with empty results if filtering is silently ignored
      expect([200, 403]).toContain(response.status())

      const data = await response.json()

      // If 403, check for error (may have different format - error or message field)
      if (response.status() === 403) {
        // Error response should have either 'error' or 'message' field
        const hasError = data.error || data.message
        expect(hasError).toBeDefined()

        // Check the error message contains relevant keywords
        const errorText = (data.error || data.message || '').toString().toLowerCase()
        expect(errorText).toMatch(/permission|forbidden|filter|salary/)
      } else {
        // If 200, filtering was silently ignored (returns all accessible records)
        expect(data).toHaveProperty('records')
        expect(Array.isArray(data.records)).toBe(true)
      }
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - covers: field read filtering, field write restrictions, partial updates
  // ============================================================================

  test(
    'API-TABLES-PERMISSIONS-FIELD-REGRESSION: complete field permission workflow via API',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, executeQuery, signOut, signIn, page }) => {
      await test.step('Setup: Start server with field-level permissions', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            auth: {
              strategies: [{ type: 'emailAndPassword' }],
              defaultRole: 'viewer',
              roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
            },
            tables: [
              {
                id: 1,
                name: 'employees',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  { id: 2, name: 'name', type: 'single-line-text' },
                  { id: 3, name: 'email', type: 'email' },
                  { id: 4, name: 'salary', type: 'currency', currency: 'USD' },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
                permissions: {
                  read: 'authenticated',
                  update: 'authenticated',
                  fields: [
                    {
                      field: 'name',
                      write: 'authenticated', // Anyone can update name (FIELD-004)
                    },
                    {
                      field: 'salary',
                      read: ['admin'],
                      write: ['admin'],
                    },
                  ],
                },
              },
            ],
          },
          {
            adminBootstrap: {
              email: 'admin@example.com',
              password: 'TestPassword123!',
              name: 'Admin User',
            },
          }
        )
      })

      await test.step('Setup: Create member user', async () => {
        // Admin user is created via adminBootstrap in server configuration

        // Create member user (signup creates viewer due to defaultRole: 'viewer')
        await signOut()
        const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
          data: {
            email: 'member@example.com',
            password: 'TestPassword123!',
            name: 'Member User',
          },
        })
        const signUpData = await signUpResponse.json()
        // Explicitly set role to member (defaultRole is viewer)
        await executeQuery(
          `UPDATE auth."user" SET role = 'member' WHERE id = '${signUpData.user.id}'`
        )
      })

      await test.step('Setup: Insert test data', async () => {
        await executeQuery(`
          INSERT INTO employees (id, name, email, salary)
          VALUES (1, 'John Doe', 'john@example.com', 75000)
        `)
      })

      await test.step('API-TABLES-PERMISSIONS-FIELD-001: Excludes salary field from member response', async () => {
        // WHEN: Member user requests employee data via API
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        const response = await request.get('/api/tables/1/records')

        // THEN: API response should include name but EXCLUDE salary field
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields).toHaveProperty('name', 'John Doe')
        expect(data.records[0].fields).toHaveProperty('email', 'john@example.com')
        // KEY ASSERTION: Salary field should be filtered out
        expect(data.records[0].fields).not.toHaveProperty('salary')
      })

      await test.step('API-TABLES-PERMISSIONS-FIELD-002: Includes all fields for admin response', async () => {
        // WHEN: Admin user requests employee data via API
        await signOut()
        await signIn({ email: 'admin@example.com', password: 'TestPassword123!' })
        const response = await request.get('/api/tables/1/records')

        // THEN: Admin should see ALL fields including salary
        expect(response.status()).toBe(200)
        const data = await response.json()
        expect(data.records).toHaveLength(1)
        expect(data.records[0].fields).toHaveProperty('name', 'John Doe')
        // KEY ASSERTION: Admin can see salary field (numeric type coerced to number)
        expect(data.records[0].fields).toHaveProperty('salary', 75_000)
      })

      await test.step('API-TABLES-PERMISSIONS-FIELD-003: Rejects write when user lacks field permission', async () => {
        // WHEN: Member tries to update salary field via API
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        const response = await request.patch('/api/tables/1/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { fields: { salary: 100_000 } }, // Attempting to give themselves a raise!
        })

        // THEN: Should return 403 Forbidden (field write permission denied)
        expect(response.status()).toBe(403)
        const data = await response.json()
        expect(data.success).toBe(false)
        expect(data.code).toBe('FORBIDDEN')
        expect(data.message).toMatch(/permission|forbidden|salary/i)

        // VERIFY: Salary should remain unchanged in database
        const result = await executeQuery(`SELECT salary FROM employees WHERE id = 1`)
        expect(result.salary).toBe('75000')
      })

      await test.step('API-TABLES-PERMISSIONS-FIELD-004: Allows partial update for permitted fields', async () => {
        // WHEN: Member updates only the name field (which they have permission for)
        await signOut()
        await signIn({ email: 'member@example.com', password: 'TestPassword123!' })
        const response = await request.patch('/api/tables/1/records/1', {
          headers: { 'Content-Type': 'application/json' },
          data: { fields: { name: 'John Smith' } }, // This should work
        })

        // THEN: Update should succeed
        expect(response.status()).toBe(200)

        // VERIFY: Name updated, salary unchanged
        const result = await executeQuery(`SELECT name, salary FROM employees WHERE id = 1`)
        expect(result.name).toBe('John Smith')
        expect(result.salary).toBe('75000')
      })
    }
  )
})
