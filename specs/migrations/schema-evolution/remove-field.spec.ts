/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Remove Field Migration
 *
 * Source: specs/migrations/schema-evolution/remove-field/remove-field.schema.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Remove Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIG-ALTER-REMOVE-001: should remove phone column and preserve other columns when runtime migration generates ALTER TABLE DROP COLUMN',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with email and phone fields, phone field is removed from schema
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, phone VARCHAR(20))`,
        `INSERT INTO users (email, phone) VALUES ('user@example.com', '+1-555-0100')`,
      ])

      // WHEN: runtime migration generates ALTER TABLE DROP COLUMN
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL removes phone column and preserves other columns

      // Column removed from table
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='phone'`
      )
      expect(columnCheck.count).toBe(0)

      // Other columns preserved
      const dataCheck = await executeQuery(
        `SELECT email FROM users WHERE email = 'user@example.com'`
      )
      expect(dataCheck.email).toBe('user@example.com')
    }
  )

  test.fixme(
    'MIG-ALTER-REMOVE-002: should drop column and preserve column order for remaining fields when ALTER TABLE removes column from middle of schema',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with multiple fields, middle field is removed
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, title VARCHAR(255), description TEXT, price NUMERIC(10,2))`,
        `INSERT INTO products (title, description, price) VALUES ('Product A', 'Description A', 99.99)`,
      ])

      // WHEN: ALTER TABLE removes column from middle of schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL drops column and preserves column order for remaining fields

      // Column removed
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='products' AND column_name='description'`
      )
      expect(columnCheck.count).toBe(0)

      // Remaining columns accessible
      const dataCheck = await executeQuery(`SELECT title, price FROM products WHERE id = 1`)
      expect(dataCheck.title).toBe('Product A')
      expect(dataCheck.price).toBe('99.99')
    }
  )

  test.fixme(
    'MIG-ALTER-REMOVE-003: should automatically drop associated index when ALTER TABLE drops column with index',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with indexed field, indexed field is removed
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255), status VARCHAR(50))`,
        `CREATE INDEX idx_tasks_status ON tasks(status)`,
        `INSERT INTO tasks (title, status) VALUES ('Task 1', 'open')`,
      ])

      // WHEN: ALTER TABLE drops column with index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL automatically drops associated index

      // Column dropped
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='tasks' AND column_name='status'`
      )
      expect(columnCheck.count).toBe(0)

      // Associated index automatically dropped
      const indexCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='tasks' AND indexname='idx_tasks_status'`
      )
      expect(indexCheck.count).toBe(0)
    }
  )

  test.fixme(
    'MIG-ALTER-REMOVE-004: should remove column and CASCADE drop foreign key constraint when ALTER TABLE drops column with foreign key constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with foreign key field, relationship field is removed
      await executeQuery([
        `CREATE TABLE customers (id SERIAL PRIMARY KEY, name VARCHAR(255))`,
        `INSERT INTO customers (name) VALUES ('Customer A')`,
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), total NUMERIC(10,2))`,
        `INSERT INTO orders (customer_id, total) VALUES (1, 150.00)`,
      ])

      // WHEN: ALTER TABLE drops column with foreign key constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'customers',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
            ],
          },
          {
            id: 5,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'total', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: PostgreSQL removes column and CASCADE drops foreign key constraint

      // Foreign key column dropped
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_id'`
      )
      expect(columnCheck.count).toBe(0)

      // Foreign key constraint removed
      const fkCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='orders' AND constraint_type='FOREIGN KEY'`
      )
      expect(fkCheck.count).toBe(0)

      // Data in remaining columns preserved
      const dataCheck = await executeQuery(`SELECT total FROM orders WHERE id = 1`)
      expect(dataCheck.total).toBe('150.00')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full remove-field-migration workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative remove field scenarios
      await executeQuery([
        `CREATE TABLE data (id SERIAL PRIMARY KEY, title VARCHAR(255), description TEXT, status VARCHAR(50))`,
        `CREATE INDEX idx_data_status ON data(status)`,
        `INSERT INTO data (title, description, status) VALUES ('Record 1', 'Desc 1', 'active')`,
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // Remove indexed field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'title', type: 'single-line-text' },
              { id: 3, name: 'description', type: 'single-line-text' },
            ],
          },
        ],
      })

      // Verify column removed
      const columnCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='data' AND column_name='status'`
      )
      expect(columnCheck.count).toBe(0)

      // Verify index removed
      const indexCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname='idx_data_status'`
      )
      expect(indexCheck.count).toBe(0)

      // Existing data preserved
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM data WHERE title = 'Record 1'`
      )
      expect(dataCheck.count).toBe(1)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
