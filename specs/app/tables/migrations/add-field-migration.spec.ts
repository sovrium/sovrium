/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Add Field Migration
 *
 * Source: specs/app/tables/migrations/add-field-migration.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Add Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-TABLES-MIGRATION-ADD-FIELD-001: should detect schema change and trigger ALTER TABLE migration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table schema with existing fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              {
                name: 'email',
                type: 'email',
                required: true,
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery("INSERT INTO users (email) VALUES ('user@example.com')")

      // WHEN: a new required field is added to the schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              {
                name: 'email',
                type: 'email',
                required: true,
              },
              {
                name: 'name',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // THEN: the system should detect schema change and trigger ALTER TABLE migration

      // Schema change should be detected
      const column = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='name'"
      )
      expect(column.column_name).toBe('name')

      // New field should have NOT NULL constraint
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='name'"
      )
      expect(nullable.is_nullable).toBe('NO')

      // Existing data should be preserved
      const count = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE email = 'user@example.com'"
      )
      expect(count.count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-ADD-FIELD-002: should trigger ALTER TABLE migration without NOT NULL constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table schema with existing fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              {
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery("INSERT INTO products (title) VALUES ('Product A')")

      // WHEN: a new optional field is added to the schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              {
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
              {
                name: 'description',
                type: 'long-text',
              },
            ],
          },
        ],
      })

      // THEN: the system should trigger ALTER TABLE migration without NOT NULL constraint

      // New field should be nullable
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='description'"
      )
      expect(nullable.is_nullable).toBe('YES')

      // Existing records should have NULL in new field
      const description = await executeQuery(
        "SELECT description FROM products WHERE title = 'Product A'"
      )
      expect(description.description).toBe(null)
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-ADD-FIELD-003: should apply default value to existing records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table schema with existing fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              {
                name: 'amount',
                type: 'decimal',
                required: true,
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery('INSERT INTO orders (amount) VALUES (100.00)')

      // WHEN: a new field with default value is added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              {
                name: 'amount',
                type: 'decimal',
                required: true,
              },
              {
                name: 'status',
                type: 'single-line-text',
                default: 'pending',
              },
            ],
          },
        ],
      })

      // THEN: the system should apply default value to existing records

      // Existing records should have default value
      const status = await executeQuery('SELECT status FROM orders WHERE amount = 100.00')
      expect(status.status).toBe('pending')

      // Column should have DEFAULT constraint
      const defaultValue = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='status'"
      )
      expect(defaultValue.column_default).toBe("'pending'::character varying")
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-MIGRATION-ADD-FIELD-REGRESSION-001: user can complete full add-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with existing data
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_test',
            name: 'test_table',
            fields: [
              {
                name: 'existing_field',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery("INSERT INTO test_table (existing_field) VALUES ('existing_value')")

      // WHEN/THEN: Add field with migration

      // Add required field with NOT NULL
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_test',
            name: 'test_table',
            fields: [
              {
                name: 'existing_field',
                type: 'single-line-text',
              },
              {
                name: 'new_required_field',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // Verify field added with correct constraints
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='test_table' AND column_name='new_required_field'"
      )
      expect(nullable.is_nullable).toBe('NO')

      // Verify existing data preserved
      const existingData = await executeQuery('SELECT COUNT(*) as count FROM test_table')
      expect(existingData.count).toBeGreaterThan(0)

      // Workflow completes successfully
    }
  )
})
