/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Rename Field Migration
 *
 * Source: specs/migrations/schema-evolution/rename-field/rename-field.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rename Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIG-ALTER-RENAME-001: should generate RENAME COLUMN instead of DROP+ADD when runtime migration detects rename via field ID',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with field id=1 name='email', field name changed to 'email_address' (same id)
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE)`,
        `INSERT INTO users (email) VALUES ('user@example.com')`,
      ])

      // WHEN: runtime migration detects rename via field ID
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
                constraints: { primaryKey: true },
              },
              {
                id: 'field_email',
                name: 'email_address',
                type: 'email',
                constraints: { required: true, unique: true },
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL generates RENAME COLUMN instead of DROP+ADD

      // Column renamed successfully
      const newColumn = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email_address'`
      )
      expect(newColumn.column_name).toBe('email_address')

      // Old column name no longer exists
      const oldColumn = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='email'`
      )
      expect(oldColumn.count).toBe(0)

      // Data preserved after rename
      const data = await executeQuery(`SELECT email_address FROM users WHERE id = 1`)
      expect(data.email_address).toBe('user@example.com')

      // Constraints preserved (UNIQUE still enforced)
      const constraints = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE'`
      )
      expect(constraints.count).toBe(1)
    }
  )

  test.fixme(
    'MIG-ALTER-RENAME-002: should rename column and automatically update index reference when RENAME COLUMN is executed on indexed field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with indexed field 'sku' renamed to 'product_code'
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, sku VARCHAR(100) NOT NULL UNIQUE)`,
        `CREATE INDEX idx_products_sku ON products(sku)`,
        `INSERT INTO products (sku) VALUES ('PROD-001')`,
      ])

      // WHEN: RENAME COLUMN is executed on indexed field
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
                constraints: { primaryKey: true },
              },
              {
                id: 'field_sku',
                name: 'product_code',
                type: 'text',
                constraints: { required: true, unique: true, indexed: true },
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column and automatically updates index reference

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='product_code'`
      )
      expect(column.column_name).toBe('product_code')

      // Index still exists and references renamed column
      const index = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE tablename='products' AND indexname='idx_products_sku'`
      )
      expect(index.indexdef).toContain('product_code')

      // Data preserved
      const data = await executeQuery(`SELECT product_code FROM products WHERE id = 1`)
      expect(data.product_code).toBe('PROD-001')
    }
  )

  test.fixme(
    'MIG-ALTER-RENAME-003: should rename column and preserve foreign key constraint when RENAME COLUMN on foreign key field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with foreign key field 'customer_id' renamed to 'client_id'
      await executeQuery([
        `CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(255))`,
        `INSERT INTO customers (name) VALUES ('Customer A')`,
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id))`,
        `INSERT INTO orders (customer_id) VALUES (1)`,
      ])

      // WHEN: RENAME COLUMN on foreign key field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_customers',
            name: 'customers',
            fields: [
              {
                name: 'id',
                type: 'integer',
                constraints: { primaryKey: true },
              },
              {
                name: 'name',
                type: 'text',
              },
            ],
          },
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              {
                name: 'id',
                type: 'integer',
                constraints: { primaryKey: true },
              },
              {
                id: 'field_customer_id',
                name: 'client_id',
                type: 'relationship',
                relationship: { table: 'customers', field: 'id' },
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column and preserves foreign key constraint

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='client_id'`
      )
      expect(column.column_name).toBe('client_id')

      // Foreign key constraint preserved
      const fk = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='FOREIGN KEY'`
      )
      expect(fk.count).toBe(1)

      // Foreign key still enforced after rename
      await expect(async () => {
        await executeQuery(`INSERT INTO orders (client_id) VALUES (999)`)
      }).rejects.toThrow(/violates foreign key constraint/i)

      // Data preserved
      const data = await executeQuery(`SELECT client_id FROM orders WHERE id = 1`)
      expect(data.client_id).toBe(1)
    }
  )

  test.fixme(
    'MIG-ALTER-RENAME-004: should rename column but CHECK constraint references old name when RENAME COLUMN on field with CHECK constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with field 'status' (CHECK constraint) renamed to 'state'
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, status VARCHAR(50) CHECK (status IN ('open', 'in_progress', 'done')))`,
        `INSERT INTO tasks (status) VALUES ('open')`,
      ])

      // WHEN: RENAME COLUMN on field with CHECK constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              {
                name: 'id',
                type: 'integer',
                constraints: { primaryKey: true },
              },
              {
                id: 'field_status',
                name: 'state',
                type: 'single-select',
                options: ['open', 'in_progress', 'done'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL renames column but CHECK constraint references old name (constraint needs update)

      // Column renamed
      const column = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='state'`
      )
      expect(column.column_name).toBe('state')

      // CHECK constraint still enforced with new column name
      const validInsert = await executeQuery(
        `INSERT INTO tasks (state) VALUES ('done') RETURNING state`
      )
      expect(validInsert.state).toBe('done')

      // Invalid value still rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO tasks (state) VALUES ('invalid')`)
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full rename-field-migration workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative rename field scenarios
      await executeQuery([
        `CREATE TABLE data (id SERIAL PRIMARY KEY, old_name VARCHAR(255) NOT NULL)`,
        `INSERT INTO data (old_name) VALUES ('test value')`,
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // Rename field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              {
                name: 'id',
                type: 'integer',
                constraints: { primaryKey: true },
              },
              {
                id: 'field_old_name',
                name: 'new_name',
                type: 'text',
                constraints: { required: true },
              },
            ],
          },
        ],
      })

      // Verify column renamed
      const newColumn = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name='data' AND column_name='new_name'`
      )
      expect(newColumn.column_name).toBe('new_name')

      // Verify old column name removed
      const oldColumn = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='data' AND column_name='old_name'`
      )
      expect(oldColumn.count).toBe(0)

      // Verify data preserved
      const data = await executeQuery(`SELECT new_name FROM data WHERE id = 1`)
      expect(data.new_name).toBe('test value')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
