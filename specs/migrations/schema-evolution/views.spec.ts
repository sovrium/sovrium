/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Database Views Migration
 *
 * Source: specs/migrations/schema-evolution/views/views.json
 * Domain: migrations
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Database Views Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-VIEW-001: should create view for read-only access',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' exists, no views defined
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255), active BOOLEAN DEFAULT true)`,
        `INSERT INTO users (name, email, active) VALUES ('Alice', 'alice@example.com', true), ('Bob', 'bob@example.com', true), ('Charlie', 'charlie@example.com', false)`,
      ])

      // WHEN: view 'active_users' added to schema (SELECT * FROM users WHERE active = true)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'active', type: 'checkbox', default: true },
            ],
            views: [
              {
                id: 'active_users',
                name: 'Active Users',
                query: 'SELECT * FROM users WHERE active = true',
              },
            ],
          },
        ],
      })

      // THEN: CREATE VIEW for read-only access

      // View exists and returns only active users
      const activeUsers = await executeQuery(`SELECT COUNT(*) as count FROM active_users`)
      expect(activeUsers.count).toBe(2)

      // View contains correct data
      const names = await executeQuery(`SELECT name FROM active_users ORDER BY name`)
      expect(names).toEqual([{ name: 'Alice' }, { name: 'Bob' }])

      // View is read-only (INSERT should fail)
      await expect(async () => {
        await executeQuery(
          `INSERT INTO active_users (name, email, active) VALUES ('Dave', 'dave@example.com', true)`
        )
      }).rejects.toThrow(/cannot insert|not updatable/i)
    }
  )

  test.fixme(
    'MIGRATION-VIEW-002: should drop view when removed',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'active_users' exists
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, active BOOLEAN DEFAULT true)`,
        `INSERT INTO users (name, active) VALUES ('Alice', true), ('Bob', false)`,
        `CREATE VIEW active_users AS SELECT * FROM users WHERE active = true`,
      ])

      // WHEN: view removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'active', type: 'checkbox', default: true },
            ],
          },
        ],
        // No views - 'active_users' should be dropped
      })

      // THEN: DROP VIEW when removed

      // View no longer exists
      const viewExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_users'`
      )
      expect(viewExists.count).toBe(0)

      // Query against view fails
      await expect(async () => {
        await executeQuery(`SELECT * FROM active_users`)
      }).rejects.toThrow(/does not exist|relation.*not found/i)

      // Base table still exists
      const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(users.count).toBe(2)
    }
  )

  test.fixme(
    'MIGRATION-VIEW-003: should alter view via drop and create',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'user_summary' exists with query A
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255), role VARCHAR(50))`,
        `INSERT INTO users (name, email, role) VALUES ('Alice', 'alice@example.com', 'admin'), ('Bob', 'bob@example.com', 'user')`,
        `CREATE VIEW user_summary AS SELECT id, name FROM users`, // Query A: only id, name
      ])

      // WHEN: view query modified to query B
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'role', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'user_summary',
                name: 'User Summary',
                query: 'SELECT id, name, email, role FROM users', // Query B: all fields
              },
            ],
          },
        ],
      })

      // THEN: ALTER VIEW via DROP and CREATE

      // View now includes all columns
      const viewColumns = await executeQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_summary' ORDER BY ordinal_position`
      )
      expect(viewColumns.map((c: { column_name: string }) => c.column_name)).toEqual([
        'id',
        'name',
        'email',
        'role',
      ])

      // View returns correct data
      const admin = await executeQuery(`SELECT name, role FROM user_summary WHERE role = 'admin'`)
      expect(admin.name).toBe('Alice')
      expect(admin.role).toBe('admin')
    }
  )

  test.fixme(
    'MIGRATION-VIEW-004: should create materialized view',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' exists, no materialized views
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER, amount NUMERIC(10,2), created_at TIMESTAMPTZ DEFAULT NOW())`,
        `INSERT INTO orders (customer_id, amount) VALUES (1, 100.00), (1, 150.00), (2, 200.00), (2, 50.00)`,
      ])

      // WHEN: materialized view 'order_stats' added (aggregation query)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'customer_id', type: 'integer' },
              { id: 3, name: 'amount', type: 'decimal' },
              { id: 4, name: 'created_at', type: 'datetime' },
            ],
            views: [
              {
                id: 'order_stats',
                name: 'Order Stats',
                query:
                  'SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total_amount FROM orders GROUP BY customer_id',
                materialized: true,
              },
            ],
          },
        ],
      })

      // THEN: CREATE MATERIALIZED VIEW

      // Materialized view exists
      const matViewExists = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_matviews WHERE matviewname = 'order_stats'`
      )
      expect(matViewExists.count).toBe(1)

      // Materialized view contains aggregated data
      const stats = await executeQuery(`SELECT * FROM order_stats WHERE customer_id = 1`)
      expect(stats.order_count).toBe(2)
      expect(parseFloat(stats.total_amount)).toBe(250.0)
    }
  )

  test.fixme(
    'MIGRATION-VIEW-005: should refresh materialized view',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: materialized view 'order_stats' exists with stale data
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER, amount NUMERIC(10,2))`,
        `INSERT INTO orders (customer_id, amount) VALUES (1, 100.00), (1, 150.00)`,
        `CREATE MATERIALIZED VIEW order_stats AS SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total_amount FROM orders GROUP BY customer_id`,
      ])

      // Add new order (stale data in materialized view)
      await executeQuery(`INSERT INTO orders (customer_id, amount) VALUES (1, 200.00)`)

      // Verify stale data
      const staleStats = await executeQuery(
        `SELECT order_count FROM order_stats WHERE customer_id = 1`
      )
      expect(staleStats.order_count).toBe(2) // Still 2, not 3

      // WHEN: refresh triggered via schema metadata or manual command
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'customer_id', type: 'integer' },
              { id: 3, name: 'amount', type: 'decimal' },
            ],
            views: [
              {
                id: 'order_stats',
                name: 'Order Stats',
                query:
                  'SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total_amount FROM orders GROUP BY customer_id',
                materialized: true,
                refreshOnMigration: true,
              },
            ],
          },
        ],
      })

      // THEN: REFRESH MATERIALIZED VIEW

      // Materialized view now has updated data
      const freshStats = await executeQuery(
        `SELECT order_count, total_amount FROM order_stats WHERE customer_id = 1`
      )
      expect(freshStats.order_count).toBe(3)
      expect(parseFloat(freshStats.total_amount)).toBe(450.0)
    }
  )

  test.fixme(
    'MIGRATION-VIEW-006: should drop view cascade',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'user_orders' exists, view 'active_orders' depends on it
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL)`,
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), status VARCHAR(50))`,
        `INSERT INTO users (name) VALUES ('Alice')`,
        `INSERT INTO orders (user_id, status) VALUES (1, 'active'), (1, 'completed')`,
        `CREATE VIEW user_orders AS SELECT u.name, o.status FROM users u JOIN orders o ON u.id = o.user_id`,
        `CREATE VIEW active_orders AS SELECT * FROM user_orders WHERE status = 'active'`,
      ])

      // WHEN: view 'user_orders' removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
            ],
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'user_id', type: 'integer' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
        // No views - both should be dropped (cascade)
      })

      // THEN: DROP VIEW CASCADE

      // Both views removed
      const userOrdersExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'user_orders'`
      )
      expect(userOrdersExists.count).toBe(0)

      const activeOrdersExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_orders'`
      )
      expect(activeOrdersExists.count).toBe(0)

      // Base tables still exist
      const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(users.count).toBe(1)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'MIGRATION-VIEW-007: user can complete full views workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Create table with view and seed data', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'products',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                { id: 2, name: 'name', type: 'single-line-text', required: true },
                { id: 3, name: 'price', type: 'decimal' },
                { id: 4, name: 'in_stock', type: 'checkbox', default: true },
              ],
              views: [
                {
                  id: 'available_products',
                  name: 'Available Products',
                  query: 'SELECT id, name, price FROM products WHERE in_stock = true',
                },
              ],
            },
          ],
        })

        // Seed test data after table creation
        await executeQuery([
          `INSERT INTO products (name, price, in_stock) VALUES ('Widget', 19.99, true), ('Gadget', 29.99, true), ('Obsolete', 9.99, false)`,
        ])
      })

      await test.step('Verify view returns only in-stock products', async () => {
        // View returns only in-stock products
        const available = await executeQuery(`SELECT COUNT(*) as count FROM available_products`)
        expect(available.count).toBe(2)

        // View data is correct
        const widget = await executeQuery(
          `SELECT name, price FROM available_products WHERE name = 'Widget'`
        )
        expect(widget.name).toBe('Widget')
        expect(parseFloat(widget.price)).toBe(19.99)

        // Out of stock product not in view
        const obsolete = await executeQuery(
          `SELECT COUNT(*) as count FROM available_products WHERE name = 'Obsolete'`
        )
        expect(obsolete.count).toBe(0)
      })
    }
  )
})
