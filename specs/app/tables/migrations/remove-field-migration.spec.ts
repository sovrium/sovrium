/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Remove Field Migration
 *
 * Source: specs/app/tables/migrations/remove-field-migration.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Remove Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-TABLES-MIGRATION-REMOVE-FIELD-001: should trigger ALTER TABLE DROP COLUMN migration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table schema with multiple fields
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, legacy_field VARCHAR(255))',
        "INSERT INTO users (email, legacy_field) VALUES ('user@example.com', 'legacy_data')",
      ])

      // WHEN: a field is removed from the schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              {
                name: 'id',
                type: 'integer',
              },
              {
                name: 'email',
                type: 'email',
              },
            ],
          },
        ],
      })

      // THEN: the system should trigger ALTER TABLE DROP COLUMN migration

      // Column should be removed from table
      const removedColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='legacy_field'"
      )
      expect(removedColumn.count).toBe(0)

      // Remaining columns should still exist
      const remainingColumns = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name IN ('id', 'email')"
      )
      expect(remainingColumns.count).toBe(2)

      // Existing data in other columns should be preserved
      const existingData = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE email = 'user@example.com'"
      )
      expect(existingData.count).toBe(1)
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-REMOVE-FIELD-002: should remove column and associated constraints',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table with a field that has constraints
      await executeQuery([
        'CREATE TABLE products (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, sku VARCHAR(50) UNIQUE NOT NULL)',
        "INSERT INTO products (title, sku) VALUES ('Product A', 'SKU-001')",
      ])

      // WHEN: the constrained field is removed
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              {
                name: 'id',
                type: 'integer',
              },
              {
                name: 'title',
                type: 'single-line-text',
                required: true,
              },
            ],
          },
        ],
      })

      // THEN: the system should remove column and associated constraints

      // Column should be removed
      const removedColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='products' AND column_name='sku'"
      )
      expect(removedColumn.count).toBe(0)

      // UNIQUE constraint should be removed
      const removedConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE' AND constraint_name LIKE '%sku%'"
      )
      expect(removedConstraint.count).toBe(0)
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-REMOVE-FIELD-003: should remove column and associated index',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table with indexed field
      await executeQuery([
        'CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_email VARCHAR(255), order_number VARCHAR(50))',
        'CREATE INDEX idx_order_number ON orders(order_number)',
        "INSERT INTO orders (customer_email, order_number) VALUES ('customer@example.com', 'ORD-001')",
      ])

      // WHEN: the indexed field is removed
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              {
                name: 'id',
                type: 'integer',
              },
              {
                name: 'customer_email',
                type: 'email',
              },
            ],
          },
        ],
      })

      // THEN: the system should remove column and associated index

      // Column should be removed
      const removedColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='orders' AND column_name='order_number'"
      )
      expect(removedColumn.count).toBe(0)

      // Index should be removed
      const removedIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='orders' AND indexname='idx_order_number'"
      )
      expect(removedIndex.count).toBe(0)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'user can complete full remove-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with multiple fields including constrained field
      await executeQuery([
        'CREATE TABLE test_table (id SERIAL PRIMARY KEY, keep_field VARCHAR(255), remove_field VARCHAR(50) UNIQUE)',
        'CREATE INDEX idx_remove_field ON test_table(remove_field)',
        "INSERT INTO test_table (keep_field, remove_field) VALUES ('keep_value', 'remove_value')",
      ])

      // WHEN/THEN: Remove field with migration

      // Remove constrained and indexed field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_test',
            name: 'test_table',
            fields: [
              {
                name: 'id',
                type: 'integer',
              },
              {
                name: 'keep_field',
                type: 'single-line-text',
              },
            ],
          },
        ],
      })

      // Verify field removed
      const removedColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='test_table' AND column_name='remove_field'"
      )
      expect(removedColumn.count).toBe(0)

      // Verify constraints removed
      const removedConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='test_table' AND constraint_name LIKE '%remove_field%'"
      )
      expect(removedConstraint.count).toBe(0)

      // Verify existing data preserved in remaining fields
      const existingData = await executeQuery(
        "SELECT COUNT(*) as count FROM test_table WHERE keep_field = 'keep_value'"
      )
      expect(existingData.count).toBe(1)

      // Workflow completes successfully
    }
  )
})
