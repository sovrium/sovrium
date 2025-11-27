/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Row-Level Security Enforcement
 *
 * Domain: app/tables/permissions
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * RLS Enforcement Scenarios:
 * - Record filtering by user/role
 * - Field-level read restrictions
 * - Field-level write restrictions
 * - Dynamic policy evaluation
 */

test.describe('Row-Level Security Enforcement', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-001: should filter records based on user ownership policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with owner-based RLS policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'notes',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'owner_id', type: 'integer' },
            ],
            rls: [
              {
                name: 'owner_access',
                command: 'SELECT',
                using: 'owner_id = current_user_id()',
              },
            ],
          },
        ],
      })

      // Create users and notes
      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User 1', true, NOW(), NOW()),
         (2, 'user2@example.com', '$2a$10$hash', 'User 2', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days'),
         (2, 2, 'user2_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO notes (id, title, owner_id) VALUES
         (1, 'User 1 Note 1', 1),
         (2, 'User 1 Note 2', 1),
         (3, 'User 2 Note 1', 2)`,
      ])

      // WHEN: User 1 queries notes
      const response = await page.request.get('/api/tables/notes/records', {})

      // THEN: Only User 1's notes returned
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.records).toHaveLength(2)
      expect(data.records.every((r: { owner_id: number }) => r.owner_id === 1)).toBe(true)
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-002: should prevent reading records not matching RLS policy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with strict RLS
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'private_data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'secret', type: 'single-line-text' },
              { id: 3, name: 'user_id', type: 'integer' },
            ],
            rls: [
              {
                name: 'user_only',
                command: 'SELECT',
                using: 'user_id = current_user_id()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User 1', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO private_data (id, secret, user_id) VALUES
         (1, 'User 1 Secret', 1),
         (2, 'Other User Secret', 2)`,
      ])

      // WHEN: User 1 tries to access record belonging to User 2
      const response = await page.request.get('/api/tables/private_data/records/2', {})

      // THEN: Access denied or record not found
      expect([403, 404]).toContain(response.status())
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-003: should enforce field-level read restrictions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with field-level read restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              {
                id: 4,
                name: 'salary',
                type: 'decimal',
                permissions: { read: ['admin', 'hr'] },
              },
              {
                id: 5,
                name: 'ssn',
                type: 'single-line-text',
                permissions: { read: ['hr'] },
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES
         (1, 'regular@example.com', '$2a$10$hash', 'Regular', true, 'user', NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'regular_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO employees (id, name, email, salary, ssn) VALUES
         (1, 'John Doe', 'john@company.com', 75000.00, '123-45-6789')`,
      ])

      // WHEN: Regular user fetches employee record
      const response = await page.request.get('/api/tables/employees/records/1', {
        headers: { Authorization: 'Bearer regular_token' },
      })

      // THEN: Sensitive fields omitted from response
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.record.name).toBe('John Doe')
      expect(data.record.email).toBe('john@company.com')
      expect(data.record.salary).toBeUndefined()
      expect(data.record.ssn).toBeUndefined()
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-004: should enforce field-level write restrictions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with field-level write restrictions
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'profiles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'display_name', type: 'single-line-text' },
              { id: 3, name: 'bio', type: 'long-text' },
              {
                id: 4,
                name: 'verified',
                type: 'checkbox',
                permissions: { write: ['admin'] },
              },
              {
                id: 5,
                name: 'role',
                type: 'single-select',
                options: ['admin', 'member', 'guest'],
                permissions: { write: ['admin'] },
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, created_at, updated_at) VALUES
         (1, 'user@example.com', '$2a$10$hash', 'User', true, 'user', NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO profiles (id, display_name, bio, verified, role) VALUES
         (1, 'User Profile', 'My bio', false, 'member')`,
      ])

      // WHEN: Regular user tries to update protected fields
      const response = await page.request.patch('/api/tables/profiles/records/1', {
        data: {
          display_name: 'Updated Name',
          verified: true,
          role: 'admin',
        },
      })

      // THEN: Protected fields not updated
      expect(response.status()).toBe(200)
      const record = await executeQuery(`SELECT * FROM profiles WHERE id = 1`)
      expect(record[0].display_name).toBe('Updated Name')
      expect(record[0].verified).toBe(false) // Not changed
      expect(record[0].role).toBe('member') // Not changed
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-005: should apply RLS policies on INSERT operations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with INSERT RLS policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'created_by', type: 'integer' },
            ],
            rls: [
              {
                name: 'insert_own',
                command: 'INSERT',
                withCheck: 'created_by = current_user_id()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user@example.com', '$2a$10$hash', 'User', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user_token', NOW() + INTERVAL '7 days')`,
      ])

      // WHEN: User tries to create record with different owner
      const response = await page.request.post('/api/tables/tasks/records', {
        data: {
          title: 'My Task',
          created_by: 999, // Different user ID
        },
      })

      // THEN: Record created with actual user ID (or rejected)
      if (response.ok()) {
        const data = await response.json()
        expect(data.record.created_by).toBe(1) // Auto-corrected to current user
      } else {
        expect(response.status()).toBe(403)
      }
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-006: should apply RLS policies on UPDATE operations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with UPDATE RLS policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'documents',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
              { id: 3, name: 'owner_id', type: 'integer' },
            ],
            rls: [
              {
                name: 'update_own',
                command: 'UPDATE',
                using: 'owner_id = current_user_id()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User 1', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO documents (id, content, owner_id) VALUES
         (1, 'User 1 Doc', 1),
         (2, 'User 2 Doc', 2)`,
      ])

      // WHEN: User 1 tries to update User 2's document
      const response = await page.request.patch('/api/tables/documents/records/2', {
        data: { content: 'Hacked!' },
      })

      // THEN: Update denied
      expect([403, 404]).toContain(response.status())

      // Document unchanged
      const doc = await executeQuery(`SELECT content FROM documents WHERE id = 2`)
      expect(doc[0].content).toBe('User 2 Doc')
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-007: should apply RLS policies on DELETE operations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with DELETE RLS policy
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'text', type: 'long-text' },
              { id: 3, name: 'author_id', type: 'integer' },
            ],
            rls: [
              {
                name: 'delete_own',
                command: 'DELETE',
                using: 'author_id = current_user_id()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User 1', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO comments (id, text, author_id) VALUES
         (1, 'User 1 Comment', 1),
         (2, 'User 2 Comment', 2)`,
      ])

      // WHEN: User 1 tries to delete User 2's comment
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is Playwright API call, not Drizzle
      const response = await page.request.delete('/api/tables/comments/records/2', {})

      // THEN: Delete denied
      expect([403, 404]).toContain(response.status())

      // Comment still exists
      const comment = await executeQuery(`SELECT * FROM comments WHERE id = 2`)
      expect(comment).toHaveLength(1)
    }
  )

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-008: should support role-based RLS policies',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with role-based access
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'reports',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'department', type: 'single-line-text' },
            ],
            rls: [
              {
                name: 'manager_all',
                command: 'SELECT',
                using: "current_user_role() = 'manager'",
              },
              {
                name: 'user_own_dept',
                command: 'SELECT',
                using: 'department = current_user_department()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, role, department, created_at, updated_at) VALUES
         (1, 'manager@example.com', '$2a$10$hash', 'Manager', true, 'manager', 'all', NOW(), NOW()),
         (2, 'sales@example.com', '$2a$10$hash', 'Sales User', true, 'user', 'sales', NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'manager_token', NOW() + INTERVAL '7 days'),
         (2, 2, 'sales_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO reports (id, title, department) VALUES
         (1, 'Sales Q1', 'sales'),
         (2, 'Engineering Q1', 'engineering'),
         (3, 'Sales Q2', 'sales')`,
      ])

      // WHEN: Manager queries reports
      const managerResponse = await page.request.get('/api/tables/reports/records', {
        headers: { Authorization: 'Bearer manager_token' },
      })

      // THEN: Manager sees all reports
      expect(managerResponse.status()).toBe(200)
      const managerData = await managerResponse.json()
      expect(managerData.records).toHaveLength(3)

      // WHEN: Sales user queries reports
      const salesResponse = await page.request.get('/api/tables/reports/records', {
        headers: { Authorization: 'Bearer sales_token' },
      })

      // THEN: Sales user only sees sales reports
      expect(salesResponse.status()).toBe(200)
      const salesData = await salesResponse.json()
      expect(salesData.records).toHaveLength(2)
      expect(salesData.records.every((r: { department: string }) => r.department === 'sales')).toBe(
        true
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-RLS-ENFORCEMENT-009: row-level security enforcement workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with owner-based RLS
      await startServerWithSchema({
        name: 'test-app',
        auth: {
          authentication: ['email-and-password'],
        },
        tables: [
          {
            id: 1,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'user_id', type: 'integer' },
            ],
            rls: [
              {
                name: 'owner_access',
                command: 'ALL',
                using: 'user_id = current_user_id()',
                withCheck: 'user_id = current_user_id()',
              },
            ],
          },
        ],
      })

      await executeQuery([
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
         (1, 'user1@example.com', '$2a$10$hash', 'User 1', true, NOW(), NOW()),
         (2, 'user2@example.com', '$2a$10$hash', 'User 2', true, NOW(), NOW())`,
        `INSERT INTO sessions (id, user_id, token, expires_at) VALUES
         (1, 1, 'user1_token', NOW() + INTERVAL '7 days')`,
        `INSERT INTO items (id, name, user_id) VALUES
         (1, 'User 1 Item', 1),
         (2, 'User 2 Item', 2)`,
      ])

      // Test 1: Read own - success
      const readResponse = await page.request.get('/api/tables/items/records', {})
      expect(readResponse.status()).toBe(200)
      const readData = await readResponse.json()
      expect(readData.records).toHaveLength(1)

      // Test 2: Read other - filtered out
      const otherResponse = await page.request.get('/api/tables/items/records/2', {})
      expect([403, 404]).toContain(otherResponse.status())

      // Test 3: Update other - denied
      const updateResponse = await page.request.patch('/api/tables/items/records/2', {
        data: { name: 'Hacked' },
      })
      expect([403, 404]).toContain(updateResponse.status())
    }
  )
})
