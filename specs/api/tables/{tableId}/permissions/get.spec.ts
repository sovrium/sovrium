/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/* eslint-disable drizzle/enforce-delete-with-where */

/**
 * E2E Tests for Check table permissions
 *
 * Source: specs/api/paths/tables/{tableId}/permissions/get.json
 * Domain: api
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Check table permissions', () => {
  // ============================================================================
  // @spec tests (one per spec) - EXHAUSTIVE coverage
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-001: should return all permissions as true for admin',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin }) => {
      // GIVEN: An authenticated admin user with an employees table
      // Admin role should have full access regardless of table-level permissions
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'decimal' },
              { id: 5, name: 'created_at', type: 'datetime' },
              { id: 6, name: 'updated_at', type: 'datetime' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Even with role restrictions, admin should override
              read: { type: 'roles', roles: ['admin', 'member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] },
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
        ],
      })

      await createAuthenticatedAdmin()

      // WHEN: Admin user checks permissions for a table
      const response = await request.get('/api/tables/1/permissions')

      // THEN: All table and field permissions should be returned as true
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('table')
      expect(data).toHaveProperty('fields')
      expect(data.table.read).toBe(true)
      expect(data.table.create).toBe(true)
      expect(data.table.update).toBe(true)
      expect(data.table.delete).toBe(true)
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-002: should reflect role restrictions for member',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An authenticated member user with limited permissions
      // Member: read + update only, salary field restricted
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Member can read and update, but not create or delete
              read: { type: 'roles', roles: ['admin', 'member'] },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin', 'member'] },
              delete: { type: 'roles', roles: ['admin'] },
              fields: [
                {
                  field: 'salary',
                  // Salary field restricted to admin only
                  read: { type: 'roles', roles: ['admin'] },
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: Member user checks permissions for a table
      const response = await request.get('/api/tables/1/permissions')

      // THEN: Permissions should reflect user's role restrictions
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.table.read).toBe(true)
      expect(data.table.create).toBe(false)
      expect(data.table.update).toBe(true)
      expect(data.table.delete).toBe(false)
      expect(data.fields.salary.read).toBe(false)
      expect(data.fields.salary.write).toBe(false)
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-003: should return 401 Unauthorized',
    { tag: '@spec' },
    async ({ request, startServerWithSchema }) => {
      // GIVEN: An unauthenticated user and a table exists with permissions configured
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Requires authentication to access
              read: { type: 'authenticated' },
              create: { type: 'authenticated' },
              update: { type: 'authenticated' },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // WHEN: Unauthenticated user attempts to check permissions
      const response = await request.get('/api/tables/1/permissions')

      // THEN: 401 Unauthorized error should be returned
      expect(response.status()).toBe(401)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('message')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-004: should return 404 Not Found',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: An authenticated user checking a non-existent table
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [{ id: 1, name: 'id', type: 'integer', required: true }],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              read: { type: 'authenticated' },
              create: { type: 'authenticated' },
              update: { type: 'authenticated' },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User checks permissions for invalid table ID
      const response = await request.get('/api/tables/9999/permissions')

      // THEN: 404 Not Found error should be returned
      expect(response.status()).toBe(404)

      const data = await response.json()
      // THEN: assertion
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Table not found')
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-005: should show sensitive fields as blocked',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedUser }) => {
      // GIVEN: A table with field-level permission restrictions
      // Authenticated user with restricted access to salary field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Table-level: authenticated users can read but not write
              read: { type: 'authenticated' },
              create: { type: 'roles', roles: ['admin'] },
              update: { type: 'roles', roles: ['admin'] },
              delete: { type: 'roles', roles: ['admin'] },
              fields: [
                {
                  // Salary field: admin-only for both read and write
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] },
                  write: { type: 'roles', roles: ['admin'] },
                },
                {
                  // Email field: readable by all authenticated, writable by admin only
                  field: 'email',
                  read: { type: 'authenticated' },
                  write: { type: 'roles', roles: ['admin'] },
                },
                {
                  // Name field: readable by all authenticated, writable by admin only
                  field: 'name',
                  read: { type: 'authenticated' },
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
        ],
      })

      await createAuthenticatedUser()

      // WHEN: User checks permissions
      const response = await request.get('/api/tables/1/permissions')

      // THEN: Sensitive fields should show read: false and write: false
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.fields.salary.read).toBe(false)
      expect(data.fields.salary.write).toBe(false)
      expect(data.fields.email.read).toBe(true)
      expect(data.fields.email.write).toBe(false)
      expect(data.fields.name.read).toBe(true)
      expect(data.fields.name.write).toBe(false)
    }
  )

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-006: should show all write operations as false for viewer',
    { tag: '@spec' },
    async ({ request, startServerWithSchema, createAuthenticatedViewer }) => {
      // GIVEN: A viewer user with read-only access
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Viewer role can only read, not create/update/delete
              read: { type: 'roles', roles: ['admin', 'member', 'viewer'] },
              create: { type: 'roles', roles: ['admin', 'member'] },
              update: { type: 'roles', roles: ['admin', 'member'] },
              delete: { type: 'roles', roles: ['admin'] },
            },
          },
        ],
      })

      // Viewer role has read-only access
      await createAuthenticatedViewer()

      // WHEN: Viewer user checks permissions
      const response = await request.get('/api/tables/1/permissions')

      // THEN: All write operations should be false (create, update, delete)
      expect(response.status()).toBe(200)

      const data = await response.json()
      // THEN: assertion
      expect(data.table.read).toBe(true)
      expect(data.table.create).toBe(false)
      expect(data.table.update).toBe(false)
      expect(data.table.delete).toBe(false)
    }
  )

  // ============================================================================
  // @regression test (exactly one) - OPTIMIZED integration
  // ============================================================================

  test.fixme(
    'API-TABLES-PERMISSIONS-CHECK-007: user can complete full permissions check workflow',
    { tag: '@regression' },
    async ({ request, startServerWithSchema, createAuthenticatedAdmin, signOut }) => {
      // GIVEN: Application with representative permissions configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'employees',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'salary', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
            permissions: {
              // Comprehensive permissions for regression testing
              read: { type: 'roles', roles: ['admin', 'member', 'viewer'] },
              create: { type: 'roles', roles: ['admin', 'member'] },
              update: { type: 'roles', roles: ['admin', 'member'] },
              delete: { type: 'roles', roles: ['admin'] },
              fields: [
                {
                  field: 'salary',
                  read: { type: 'roles', roles: ['admin'] },
                  write: { type: 'roles', roles: ['admin'] },
                },
              ],
            },
          },
        ],
      })

      // WHEN/THEN: Test admin permissions
      await createAuthenticatedAdmin()
      const adminResponse = await request.get('/api/tables/1/permissions')
      // THEN: assertion
      expect(adminResponse.status()).toBe(200)
      const adminData = await adminResponse.json()
      // THEN: assertion
      expect(adminData.table.read).toBe(true)
      expect(adminData.table.create).toBe(true)

      // WHEN/THEN: Test unauthenticated rejection
      await signOut()
      const unauthResponse = await request.get('/api/tables/1/permissions')
      // THEN: assertion
      expect(unauthResponse.status()).toBe(401)

      // WHEN/THEN: Test non-existent table
      await createAuthenticatedAdmin()
      const notFoundResponse = await request.get('/api/tables/9999/permissions')
      // THEN: assertion
      expect(notFoundResponse.status()).toBe(404)
    }
  )
})
