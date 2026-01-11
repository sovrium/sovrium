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

  test(
    'MIGRATION-VIEW-001: should create view for read-only access',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' exists, no views defined
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'active', type: 'checkbox', default: true },
            ],
          },
        ],
      })

      // Insert data after table creation
      await executeQuery([
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
      expect(activeUsers.count).toBe('2')

      // View contains correct data
      const names = await executeQuery(`SELECT name FROM active_users ORDER BY name`)
      expect(names.rows).toEqual([{ name: 'Alice' }, { name: 'Bob' }])

      // View is read-only (INSERT should fail)
      let insertFailed = false
      try {
        await executeQuery(
          `INSERT INTO active_users (name, email, active) VALUES ('Dave', 'dave@example.com', true)`
        )
      } catch (error) {
        insertFailed = true
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).toMatch(/cannot insert|not updatable/i)
      }
      expect(insertFailed).toBe(true)
    }
  )

  test(
    'MIGRATION-VIEW-002: should drop view when removed',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'active_users' exists
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'active', type: 'checkbox', default: true },
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

      // Insert data and create view after server started
      await executeQuery([
        `INSERT INTO users (name, active) VALUES ('Alice', true), ('Bob', false)`,
      ])

      // WHEN: view removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
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
      expect(viewExists.count).toBe('0')

      // Query against view fails
      await expect(async () => {
        await executeQuery(`SELECT * FROM active_users`)
      }).rejects.toThrow(/does not exist|relation.*not found/i)

      // Base table still exists
      const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(users.count).toBe('2')
    }
  )

  test(
    'MIGRATION-VIEW-003: should alter view via drop and create',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'user_summary' exists with query A
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' },
              { id: 4, name: 'role', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'user_summary',
                name: 'User Summary',
                query: 'SELECT id, name FROM users', // Query A: only id, name
              },
            ],
          },
        ],
      })

      // Insert data after table creation
      await executeQuery([
        `INSERT INTO users (name, email, role) VALUES ('Alice', 'alice@example.com', 'admin'), ('Bob', 'bob@example.com', 'user')`,
      ])

      // WHEN: view query modified to query B
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
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
      expect(viewColumns.rows.map((c: { column_name: string }) => c.column_name)).toEqual([
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

  test(
    'MIGRATION-VIEW-004: should create materialized view',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' exists, no materialized views
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
              { id: 2, name: 'customer_id', type: 'integer' },
              { id: 3, name: 'amount', type: 'decimal' },
              { id: 4, name: 'created_at', type: 'datetime' },
            ],
          },
        ],
      })

      // Insert data after table creation
      await executeQuery([
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
      expect(matViewExists.count).toBe('1')

      // Materialized view contains aggregated data
      const stats = await executeQuery(`SELECT * FROM order_stats WHERE customer_id = 1`)
      expect(parseInt(stats.order_count)).toBe(2)
      expect(parseFloat(stats.total_amount)).toBe(250.0)
    }
  )

  test(
    'MIGRATION-VIEW-005: should refresh materialized view',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: materialized view 'order_stats' exists with stale data
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
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
              },
            ],
          },
        ],
      })

      // Insert data after table creation
      await executeQuery([
        `INSERT INTO orders (customer_id, amount) VALUES (1, 100.00), (1, 150.00)`,
      ])

      // Refresh materialized view to populate it with initial data
      await executeQuery(`REFRESH MATERIALIZED VIEW order_stats`)

      // Add new order (stale data in materialized view)
      await executeQuery(`INSERT INTO orders (customer_id, amount) VALUES (1, 200.00)`)

      // Verify stale data
      const staleStats = await executeQuery(
        `SELECT order_count FROM order_stats WHERE customer_id = 1`
      )
      expect(staleStats.order_count).toBe('2') // Still 2, not 3

      // WHEN: refresh triggered via schema metadata or manual command
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'orders',
            fields: [
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
      expect(freshStats.order_count).toBe('3')
      expect(parseFloat(freshStats.total_amount)).toBe(450.0)
    }
  )

  test(
    'MIGRATION-VIEW-006: should drop view cascade',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: view 'user_orders' exists in schema (which creates 'active_orders' as dependent view)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'name', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              { id: 2, name: 'user_id', type: 'integer' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
            views: [
              {
                id: 'user_orders',
                name: 'User Orders',
                query: 'SELECT u.name, o.status FROM users u JOIN orders o ON u.id = o.user_id',
              },
            ],
          },
        ],
      })

      // Insert data and create dependent view manually (simulates cascading dependency)
      await executeQuery([
        `INSERT INTO users (name) VALUES ('Alice')`,
        `INSERT INTO orders (user_id, status) VALUES (1, 'active'), (1, 'completed')`,
        `CREATE VIEW active_orders AS SELECT * FROM user_orders WHERE status = 'active'`,
      ])

      // WHEN: view 'user_orders' removed from schema
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [{ id: 2, name: 'name', type: 'single-line-text', required: true }],
          },
          {
            id: 2,
            name: 'orders',
            fields: [
              { id: 2, name: 'user_id', type: 'integer' },
              { id: 3, name: 'status', type: 'single-line-text' },
            ],
          },
        ],
        // No views - both should be dropped (cascade)
      })

      // THEN: DROP VIEW CASCADE

      // Both views removed (CASCADE drops dependent view too)
      const userOrdersExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'user_orders'`
      )
      expect(userOrdersExists.count).toBe('0')

      const activeOrdersExists = await executeQuery(
        `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_orders'`
      )
      expect(activeOrdersExists.count).toBe('0')

      // Base tables still exist
      const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
      expect(users.count).toBe('1')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 6 @spec tests - covers: view creation, drop, alter, materialized views, refresh, cascade
  // ============================================================================

  test(
    'MIGRATION-VIEW-REGRESSION: user can complete full views workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Consolidated schema with ALL fields needed across ALL steps
      // Users table: id=1, fields: name(2), email(3), active(4), role(5)
      // Orders table: id=2, fields: customer_id(2), amount(3), created_at(4), user_id(5), status(6)
      const usersFields = [
        { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        { id: 3, name: 'email', type: 'email' as const },
        { id: 4, name: 'active', type: 'checkbox' as const, default: true },
        { id: 5, name: 'role', type: 'single-line-text' as const },
      ]

      const ordersFields = [
        { id: 2, name: 'customer_id', type: 'integer' as const },
        { id: 3, name: 'amount', type: 'decimal' as const },
        { id: 4, name: 'created_at', type: 'datetime' as const },
        { id: 5, name: 'user_id', type: 'integer' as const },
        { id: 6, name: 'status', type: 'single-line-text' as const },
      ]

      await test.step('Setup: Create base schema with all tables and fields', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // Seed data for all scenarios
        await executeQuery([
          `INSERT INTO users (name, email, active, role) VALUES
            ('Alice', 'alice@example.com', true, 'admin'),
            ('Bob', 'bob@example.com', true, 'user'),
            ('Charlie', 'charlie@example.com', false, 'user')`,
          `INSERT INTO orders (customer_id, amount, user_id, status) VALUES
            (1, 100.00, 1, 'active'),
            (1, 150.00, 1, 'completed'),
            (2, 200.00, 2, 'active'),
            (2, 50.00, 2, 'pending')`,
        ])
      })

      await test.step('MIGRATION-VIEW-001: creates view for read-only access', async () => {
        // Add view to schema (same base schema, just add view)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: usersFields,
              views: [
                {
                  id: 'active_users',
                  name: 'Active Users',
                  query: 'SELECT * FROM users WHERE active = true',
                },
              ],
            },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // View returns only active users (Alice and Bob)
        const activeUsers = await executeQuery(`SELECT COUNT(*) as count FROM active_users`)
        expect(activeUsers.count).toBe('2')

        // View is read-only
        let insertFailed = false
        try {
          await executeQuery(
            `INSERT INTO active_users (name, email, active) VALUES ('Dave', 'dave@example.com', true)`
          )
        } catch {
          insertFailed = true
        }
        expect(insertFailed).toBe(true)
      })

      await test.step('MIGRATION-VIEW-002: drops view when removed', async () => {
        // Remove view from schema (same base schema, no views)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // View no longer exists
        const viewExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_users'`
        )
        expect(viewExists.count).toBe('0')

        // Base table still exists with original data
        const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(users.count).toBe('3')
      })

      await test.step('MIGRATION-VIEW-003: alters view via drop and create', async () => {
        // Add view with partial columns (query A: only id, name)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: usersFields,
              views: [
                {
                  id: 'user_summary',
                  name: 'User Summary',
                  query: 'SELECT id, name FROM users',
                },
              ],
            },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // Modify view query (query B: include email and role)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'users',
              fields: usersFields,
              views: [
                {
                  id: 'user_summary',
                  name: 'User Summary',
                  query: 'SELECT id, name, email, role FROM users',
                },
              ],
            },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // View now includes all columns
        const viewColumns = await executeQuery(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_summary' ORDER BY ordinal_position`
        )
        expect(viewColumns.rows.map((c: { column_name: string }) => c.column_name)).toEqual([
          'id',
          'name',
          'email',
          'role',
        ])
      })

      await test.step('MIGRATION-VIEW-004: creates materialized view', async () => {
        // Remove user views, add materialized view on orders
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            {
              id: 2,
              name: 'orders',
              fields: ordersFields,
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

        // Materialized view exists
        const matViewExists = await executeQuery(
          `SELECT COUNT(*) as count FROM pg_matviews WHERE matviewname = 'order_stats'`
        )
        expect(matViewExists.count).toBe('1')

        // Materialized view contains aggregated data (customer 1 has 2 orders totaling 250)
        const stats = await executeQuery(`SELECT * FROM order_stats WHERE customer_id = 1`)
        expect(parseInt(stats.order_count)).toBe(2)
        expect(parseFloat(stats.total_amount)).toBe(250.0)
      })

      await test.step('MIGRATION-VIEW-005: refreshes materialized view', async () => {
        // Add new order for customer 1
        await executeQuery(`INSERT INTO orders (customer_id, amount) VALUES (1, 200.00)`)

        // Verify stale data (materialized view not refreshed yet)
        const staleStats = await executeQuery(
          `SELECT order_count FROM order_stats WHERE customer_id = 1`
        )
        expect(staleStats.order_count).toBe('2')

        // Trigger refresh via schema metadata
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            {
              id: 2,
              name: 'orders',
              fields: ordersFields,
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

        // Materialized view now has updated data (3 orders totaling 450)
        const freshStats = await executeQuery(
          `SELECT order_count, total_amount FROM order_stats WHERE customer_id = 1`
        )
        expect(freshStats.order_count).toBe('3')
        expect(parseFloat(freshStats.total_amount)).toBe(450.0)
      })

      await test.step('MIGRATION-VIEW-006: drops view cascade', async () => {
        // Add view with join between users and orders
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            {
              id: 2,
              name: 'orders',
              fields: ordersFields,
              views: [
                {
                  id: 'user_orders',
                  name: 'User Orders',
                  query: 'SELECT u.name, o.status FROM users u JOIN orders o ON u.id = o.user_id',
                },
              ],
            },
          ],
        })

        // Create dependent view manually
        await executeQuery([
          `CREATE VIEW active_orders AS SELECT * FROM user_orders WHERE status = 'active'`,
        ])

        // Remove view from schema (should cascade)
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            { id: 1, name: 'users', fields: usersFields },
            { id: 2, name: 'orders', fields: ordersFields },
          ],
        })

        // Both views removed (CASCADE)
        const userOrdersExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'user_orders'`
        )
        expect(userOrdersExists.count).toBe('0')

        const activeOrdersExists = await executeQuery(
          `SELECT COUNT(*) as count FROM information_schema.views WHERE table_name = 'active_orders'`
        )
        expect(activeOrdersExists.count).toBe('0')

        // Base tables still exist
        const users = await executeQuery(`SELECT COUNT(*) as count FROM users`)
        expect(users.count).toBe('3')
      })
    }
  )
})
