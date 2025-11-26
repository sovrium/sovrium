/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Add Field Migration
 *
 * Source: specs/migrations/schema-evolution/add-field/add-field.json
 * Domain: migrations
 * Spec Count: 4
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (4 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Add Field Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIG-ALTER-ADD-001: should add TEXT NOT NULL column to existing table when runtime migration generates ALTER TABLE ADD COLUMN',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with email field exists, new field 'name' (single-line-text, required) is added to schema
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`,
        `INSERT INTO users (email) VALUES ('user@example.com')`,
      ])

      // WHEN: runtime migration generates ALTER TABLE ADD COLUMN
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
                name: 'email',
                type: 'email',
                constraints: { required: true, unique: true },
              },
              {
                name: 'name',
                type: 'text',
                constraints: { required: true },
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT NOT NULL column to existing table

      // Column added to existing table
      const columnCheck = await executeQuery(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='name'`
      )
      expect(columnCheck.column_name).toBe('name')
      expect(columnCheck.data_type).toBe('character varying')
      expect(columnCheck.is_nullable).toBe('NO')

      // Existing data preserved after migration
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE email = 'user@example.com'`
      )
      expect(dataCheck.count).toBe(1)
    }
  )

  test.fixme(
    'MIG-ALTER-ADD-002: should add TEXT column without NOT NULL constraint when ALTER TABLE adds nullable column',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with title field, new optional field 'description' (long-text) is added
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL)`,
        `INSERT INTO products (title) VALUES ('MacBook Pro'), ('iPhone 15')`,
      ])

      // WHEN: ALTER TABLE adds nullable column
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
                name: 'title',
                type: 'text',
                constraints: { required: true },
              },
              {
                name: 'description',
                type: 'text',
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT column without NOT NULL constraint

      // Nullable column added
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='description'`
      )
      expect(columnCheck.is_nullable).toBe('YES')

      // Existing records have NULL for new column
      const dataCheck = await executeQuery(
        `SELECT title, description FROM products WHERE title = 'MacBook Pro'`
      )
      expect(dataCheck.title).toBe('MacBook Pro')
      expect(dataCheck.description).toBeNull()
    }
  )

  test.fixme(
    'MIG-ALTER-ADD-003: should add TEXT column with CHECK constraint for enum values when ALTER TABLE adds column with CHECK constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' exists, new field 'priority' (single-select with options) is added
      await executeQuery([
        `CREATE TABLE tasks (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL)`,
      ])

      // WHEN: ALTER TABLE adds column with CHECK constraint
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
                name: 'title',
                type: 'text',
                constraints: { required: true },
              },
              {
                name: 'priority',
                type: 'single-select',
                options: ['low', 'medium', 'high'],
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds TEXT column with CHECK constraint for enum values

      // CHECK constraint enforced after addition
      const validInsert = await executeQuery(
        `INSERT INTO tasks (title, priority) VALUES ('Valid task', 'high') RETURNING priority`
      )
      expect(validInsert.priority).toBe('high')

      // Invalid enum value rejected
      await expect(async () => {
        await executeQuery(
          `INSERT INTO tasks (title, priority) VALUES ('Invalid task', 'critical')`
        )
      }).rejects.toThrow(/violates check constraint/i)
    }
  )

  test.fixme(
    'MIG-ALTER-ADD-004: should add column with default value applied to existing rows when ALTER TABLE adds column with DEFAULT',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' exists, new field 'total' (decimal) with default value is added
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, order_number VARCHAR(50) NOT NULL)`,
        `INSERT INTO orders (order_number) VALUES ('ORD-001'), ('ORD-002')`,
      ])

      // WHEN: ALTER TABLE adds column with DEFAULT
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
                constraints: { primaryKey: true },
              },
              {
                name: 'order_number',
                type: 'text',
                constraints: { required: true },
              },
              {
                name: 'total',
                type: 'decimal',
                constraints: { required: true },
                default: 0,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL adds column with default value applied to existing rows

      // Default applied to existing rows
      const existingRow = await executeQuery(
        `SELECT order_number, total FROM orders WHERE order_number = 'ORD-001'`
      )
      expect(existingRow.order_number).toBe('ORD-001')
      expect(existingRow.total).toBe('0.0000')

      // New rows can override default
      const newRow = await executeQuery(
        `INSERT INTO orders (order_number, total) VALUES ('ORD-003', 150.50) RETURNING total`
      )
      expect(newRow.total).toBe('150.5000')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full add-field-migration workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative add field scenarios
      await executeQuery([
        `CREATE TABLE data (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL)`,
        `INSERT INTO data (title) VALUES ('Initial record')`,
      ])

      // WHEN/THEN: Streamlined workflow testing integration points

      // Add optional field
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
                name: 'title',
                type: 'text',
                constraints: { required: true },
              },
              {
                name: 'description',
                type: 'text',
              },
            ],
          },
        ],
      })

      // Verify nullable column added
      const columnCheck = await executeQuery(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='description'`
      )
      expect(columnCheck.is_nullable).toBe('YES')

      // Existing data preserved
      const dataCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM data WHERE title = 'Initial record'`
      )
      expect(dataCheck.count).toBe(1)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
