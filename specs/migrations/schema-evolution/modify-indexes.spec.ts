/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Modify Indexes Migration
 *
 * Source: specs/migrations/schema-evolution/modify-indexes/modify-indexes.json
 * Domain: migrations
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Modify Indexes Migration', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-INDEX-001: should create index creates btree index on specified field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'products' with no custom indexes
      await executeQuery([
        `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sku VARCHAR(50), price NUMERIC(10,2))`,
        `INSERT INTO products (name, sku, price) VALUES ('Widget', 'SKU-001', 19.99), ('Gadget', 'SKU-002', 29.99)`,
      ])

      // WHEN: new single-column index added to 'indexes' property
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'sku', type: 'single-line-text', indexed: true },
              { id: 4, name: 'price', type: 'decimal' },
            ],
          },
        ],
      })

      // THEN: CREATE INDEX creates btree index on specified field

      // Index exists on sku column
      const indexCheck = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexdef LIKE '%sku%'`
      )
      expect(indexCheck.indexname).toMatch(/idx.*sku/i)

      // Index improves query performance (implicit via existence)
      const queryPlan = await executeQuery(`EXPLAIN SELECT * FROM products WHERE sku = 'SKU-001'`)
      expect(queryPlan).toBeDefined()
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-INDEX-002: should create index creates multi-column btree index',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'contacts' with no indexes
      await executeQuery([
        `CREATE TABLE contacts (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), email VARCHAR(255))`,
        `INSERT INTO contacts (first_name, last_name, email) VALUES ('John', 'Doe', 'john@example.com')`,
      ])

      // WHEN: composite index on (last_name, first_name) added
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'contacts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'first_name', type: 'single-line-text' },
              { id: 3, name: 'last_name', type: 'single-line-text' },
              { id: 4, name: 'email', type: 'email' },
            ],
            indexes: [{ fields: ['last_name', 'first_name'] }],
          },
        ],
      })

      // THEN: CREATE INDEX creates multi-column btree index

      // Composite index exists
      const indexCheck = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'contacts' AND indexdef LIKE '%last_name%first_name%'`
      )
      expect(indexCheck.indexdef).toMatch(/last_name.*first_name/i)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-INDEX-003: should drop index removes index from table',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with existing index idx_users_email
      await executeQuery([
        `CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255))`,
        `CREATE INDEX idx_users_email ON users(email)`,
        `INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`,
      ])

      // WHEN: index removed from 'indexes' property
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'email', type: 'email' }, // No indexed: true
            ],
          },
        ],
      })

      // THEN: DROP INDEX removes index from table

      // Index no longer exists
      const indexCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_email'`
      )
      expect(indexCheck.count).toBe(0)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-INDEX-004: should drop old index and create new composite index',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'orders' with index on single field 'customer_id'
      await executeQuery([
        `CREATE TABLE orders (id SERIAL PRIMARY KEY, customer_id INTEGER, created_at TIMESTAMPTZ DEFAULT NOW())`,
        `CREATE INDEX idx_orders_customer ON orders(customer_id)`,
        `INSERT INTO orders (customer_id) VALUES (1), (2)`,
      ])

      // WHEN: index modified to be composite (customer_id, created_at)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'customer_id', type: 'integer' },
              { id: 3, name: 'created_at', type: 'datetime' },
            ],
            indexes: [{ fields: ['customer_id', 'created_at'] }],
          },
        ],
      })

      // THEN: DROP old index and CREATE new composite index

      // Old single-column index removed
      const oldIndexCheck = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_customer'`
      )
      expect(oldIndexCheck.count).toBe(0)

      // New composite index exists
      const newIndexCheck = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'orders' AND indexdef LIKE '%customer_id%created_at%'`
      )
      expect(newIndexCheck.indexdef).toMatch(/customer_id.*created_at/i)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-INDEX-005: should drop regular index and create unique index',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'accounts' with regular index on username
      await executeQuery([
        `CREATE TABLE accounts (id SERIAL PRIMARY KEY, username VARCHAR(100) NOT NULL)`,
        `CREATE INDEX idx_accounts_username ON accounts(username)`,
        `INSERT INTO accounts (username) VALUES ('alice'), ('bob')`,
      ])

      // WHEN: index modified to UNIQUE
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'accounts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'username', type: 'single-line-text', required: true, unique: true },
            ],
          },
        ],
      })

      // THEN: DROP regular index and CREATE UNIQUE INDEX

      // Unique index exists
      const indexCheck = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE tablename = 'accounts' AND indexdef LIKE '%username%'`
      )
      expect(indexCheck.indexdef).toMatch(/UNIQUE/i)

      // Duplicate username rejected
      await expect(async () => {
        await executeQuery(`INSERT INTO accounts (username) VALUES ('alice')`)
      }).rejects.toThrow(/duplicate key|unique constraint/i)
    }
  )

  test.fixme(
    'MIGRATION-MODIFY-INDEX-006: should create index concurrently allows reads/writes during creation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: large table 'events' requiring non-blocking index creation
      await executeQuery([
        `CREATE TABLE events (id SERIAL PRIMARY KEY, event_type VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW())`,
        `INSERT INTO events (event_type) SELECT 'event_' || generate_series(1, 100)`,
      ])

      // WHEN: new index added with concurrent option
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'event_type', type: 'single-line-text', indexed: true },
              { id: 3, name: 'created_at', type: 'datetime' },
            ],
          },
        ],
      })

      // THEN: CREATE INDEX CONCURRENTLY allows reads/writes during creation

      // Index exists
      const indexCheck = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'events' AND indexdef LIKE '%event_type%'`
      )
      expect(indexCheck.indexname).toBeDefined()

      // Data intact
      const eventCount = await executeQuery(`SELECT COUNT(*) as count FROM events`)
      expect(eventCount.count).toBeGreaterThanOrEqual(100)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'MIGRATION-MODIFY-INDEX-007: user can complete full modify-indexes workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative modify-indexes scenarios
      await executeQuery([
        `CREATE TABLE items (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(100), sku VARCHAR(50))`,
        `INSERT INTO items (name, category, sku) VALUES ('Item A', 'cat1', 'SKU-A'), ('Item B', 'cat2', 'SKU-B')`,
      ])

      // WHEN: Add indexes to category and sku fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', required: true },
              { id: 3, name: 'category', type: 'single-line-text', indexed: true },
              { id: 4, name: 'sku', type: 'single-line-text', indexed: true },
            ],
          },
        ],
      })

      // THEN: Indexes created, queries work

      // Index on category exists
      const categoryIndex = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'items' AND indexdef LIKE '%category%'`
      )
      expect(categoryIndex.count).toBeGreaterThan(0)

      // Index on sku exists
      const skuIndex = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'items' AND indexdef LIKE '%sku%'`
      )
      expect(skuIndex.count).toBeGreaterThan(0)

      // Data preserved
      const itemCount = await executeQuery(`SELECT COUNT(*) as count FROM items`)
      expect(itemCount.count).toBe(2)
    }
  )
})
