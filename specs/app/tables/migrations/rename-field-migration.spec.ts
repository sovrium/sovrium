/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rename Field Migration
 *
 * Source: specs/app/tables/migrations/rename-field-migration.schema.json
 * Domain: app
 * Spec Count: 3
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (3 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rename Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-TABLES-MIGRATION-RENAME-FIELD-001: should trigger ALTER TABLE RENAME COLUMN migration',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table schema with existing field
      await executeQuery([
        'CREATE TABLE users (id SERIAL PRIMARY KEY, user_email VARCHAR(255) NOT NULL)',
        "INSERT INTO users (user_email) VALUES ('user@example.com')",
      ])

      // WHEN: a field is renamed in the schema
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

      // THEN: the system should trigger ALTER TABLE RENAME COLUMN migration

      // Old column name should no longer exist
      const oldColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='user_email'"
      )
      expect(oldColumn.count).toBe(0)

      // New column name should exist
      const newColumn = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email'"
      )
      expect(newColumn.column_name).toBe('email')

      // Existing data should be preserved in renamed column
      const data = await executeQuery('SELECT email FROM users WHERE id = 1')
      expect(data.email).toBe('user@example.com')
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-RENAME-FIELD-002: should preserve constraints on renamed column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table with constrained field
      await executeQuery([
        'CREATE TABLE products (id SERIAL PRIMARY KEY, product_sku VARCHAR(50) UNIQUE NOT NULL)',
        "INSERT INTO products (product_sku) VALUES ('SKU-001')",
      ])

      // WHEN: the constrained field is renamed
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
                name: 'sku',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: the system should preserve constraints on renamed column

      // Renamed column should preserve NOT NULL constraint
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='sku'"
      )
      expect(nullable.is_nullable).toBe('NO')

      // Renamed column should preserve UNIQUE constraint
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='products' AND constraint_type='UNIQUE'"
      )
      expect(uniqueConstraint.count).toBe(1)

      // Data should be preserved after rename
      const data = await executeQuery('SELECT sku FROM products WHERE id = 1')
      expect(data.sku).toBe('SKU-001')
    }
  )

  test.fixme(
    'APP-TABLES-MIGRATION-RENAME-FIELD-003: should preserve index on renamed column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: a table with indexed field
      await executeQuery([
        'CREATE TABLE orders (id SERIAL PRIMARY KEY, old_order_number VARCHAR(50))',
        'CREATE INDEX idx_old_order_number ON orders(old_order_number)',
        "INSERT INTO orders (old_order_number) VALUES ('ORD-001')",
      ])

      // WHEN: the indexed field is renamed
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
                name: 'order_number',
                type: 'single-line-text',
                indexed: true,
              },
            ],
          },
        ],
      })

      // THEN: the system should preserve index on renamed column

      // Column should be renamed
      const column = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='order_number'"
      )
      expect(column.column_name).toBe('order_number')

      // Index should still exist (possibly renamed)
      const index = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='orders' AND indexdef LIKE '%order_number%'"
      )
      expect(index.count).toBe(1)

      // Data should be accessible with new column name
      const data = await executeQuery('SELECT order_number FROM orders WHERE id = 1')
      expect(data.order_number).toBe('ORD-001')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-MIGRATION-RENAME-FIELD-REGRESSION-001: user can complete full rename-field-migration workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Table with field that has constraints and index
      await executeQuery([
        'CREATE TABLE test_table (id SERIAL PRIMARY KEY, old_field_name VARCHAR(50) UNIQUE NOT NULL)',
        'CREATE INDEX idx_old_field_name ON test_table(old_field_name)',
        "INSERT INTO test_table (old_field_name) VALUES ('test_value')",
      ])

      // WHEN/THEN: Rename field with migration

      // Rename field while preserving constraints and indexes
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
                name: 'new_field_name',
                type: 'single-line-text',
                required: true,
                unique: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      // Verify field renamed
      const newColumn = await executeQuery(
        "SELECT column_name FROM information_schema.columns WHERE table_name='test_table' AND column_name='new_field_name'"
      )
      expect(newColumn.column_name).toBe('new_field_name')

      // Verify old field gone
      const oldColumn = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='test_table' AND column_name='old_field_name'"
      )
      expect(oldColumn.count).toBe(0)

      // Verify constraints preserved
      const nullable = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='test_table' AND column_name='new_field_name'"
      )
      expect(nullable.is_nullable).toBe('NO')

      // Verify data preserved
      const data = await executeQuery('SELECT new_field_name FROM test_table WHERE id = 1')
      expect(data.new_field_name).toBe('test_value')

      // Workflow completes successfully
    }
  )
})
