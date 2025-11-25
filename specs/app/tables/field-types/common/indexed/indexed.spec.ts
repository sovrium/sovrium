/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Indexed Field Property
 *
 * Source: specs/app/tables/field-types/common/indexed/indexed.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Indexed Field Property', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-INDEXED-001: should create btree index optimizing queries when field has indexed: true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', indexed: true },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO users (email) VALUES ('alice@example.com'), ('bob@example.com'), ('charlie@example.com')",
      ])

      // WHEN: field migration creates btree index
      // THEN: PostgreSQL CREATE INDEX statement optimizes queries on field
      const indexCheck = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_users_email'"
      )
      expect(indexCheck).toEqual({ indexname: 'idx_users_email', tablename: 'users' })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_users_email'"
      )
      expect(indexDef.indexdef).toContain('USING btree (email)')

      const lookup = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE email = 'alice@example.com'"
      )
      expect(lookup.count).toBe(1)
    }
  )

  test.fixme(
    'APP-FIELD-INDEXED-002: should not create index for field when field has indexed: false (default)',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: field with indexed: false (default)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'description', type: 'long-text', indexed: false },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO products (name, description) VALUES ('Product 1', 'Description 1')",
      ])

      // WHEN: field migration creates column without index
      // THEN: PostgreSQL does not create index for field (except primary key)
      const noIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='products' AND indexname LIKE '%description%'"
      )
      expect(noIndex.count).toBe(0)

      const onlyPrimaryKey = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename='products'"
      )
      expect(onlyPrimaryKey.indexname).toBe('products_pkey')

      const sequentialScan = await executeQuery(
        "SELECT name FROM products WHERE description LIKE '%Description%'"
      )
      expect(sequentialScan.name).toBe('Product 1')
    }
  )

  test.fixme(
    'APP-FIELD-INDEXED-003: should optimize date range and ORDER BY queries when timestamp field has indexed: true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: timestamp field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_events',
            name: 'events',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'text' },
              { name: 'occurred_at', type: 'datetime', indexed: true },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO events (name, occurred_at) VALUES ('Event 1', '2024-01-01 10:00:00'), ('Event 2', '2024-01-02 10:00:00'), ('Event 3', '2024-01-03 10:00:00')",
      ])

      // WHEN: index created for range queries
      // THEN: PostgreSQL btree index optimizes date range and ORDER BY queries
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_events_occurred_at'"
      )
      expect(indexExists.indexname).toBe('idx_events_occurred_at')

      const rangeQuery = await executeQuery(
        "SELECT COUNT(*) as count FROM events WHERE occurred_at > '2024-01-01'"
      )
      expect(rangeQuery.count).toBe(2)

      const orderBy = await executeQuery(
        'SELECT name FROM events ORDER BY occurred_at DESC LIMIT 1'
      )
      expect(orderBy.name).toBe('Event 3')
    }
  )

  test.fixme(
    'APP-FIELD-INDEXED-004: should use index for WHERE, JOIN, and ORDER BY operations when frequently queried field has indexed: true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: frequently queried field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_orders',
            name: 'orders',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'customer_id', type: 'integer', indexed: true },
              { name: 'status', type: 'text' },
              { name: 'total', type: 'decimal' },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO orders (customer_id, status, total) VALUES (1, 'pending', 99.99), (1, 'completed', 149.99), (2, 'pending', 75.00)",
      ])

      // WHEN: index improves query performance
      // THEN: PostgreSQL uses index for WHERE, JOIN, and ORDER BY operations
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_orders_customer_id'"
      )
      expect(indexExists.indexname).toBe('idx_orders_customer_id')

      const filterQuery = await executeQuery(
        'SELECT COUNT(*) as count FROM orders WHERE customer_id = 1'
      )
      expect(filterQuery.count).toBe(2)

      const groupedQuery = await executeQuery(
        'SELECT customer_id, COUNT(*) as order_count FROM orders GROUP BY customer_id ORDER BY customer_id'
      )
      expect(groupedQuery).toEqual([
        { customer_id: 1, order_count: 2 },
        { customer_id: 2, order_count: 1 },
      ])
    }
  )

  test.fixme(
    'APP-FIELD-INDEXED-005: should improve prefix searches when text field has indexed: true for LIKE queries',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: text field with indexed: true for LIKE queries
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_companies',
            name: 'companies',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'single-line-text', indexed: true },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO companies (name) VALUES ('Acme Corp'), ('Acme Industries'), ('Beta LLC'), ('Gamma Inc')",
      ])

      // WHEN: index created with btree
      // THEN: PostgreSQL index improves prefix searches (name LIKE 'prefix%')
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_companies_name'"
      )
      expect(indexExists.indexname).toBe('idx_companies_name')

      const prefixSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM companies WHERE name LIKE 'Acme%'"
      )
      expect(prefixSearch.count).toBe(2)

      const exactMatch = await executeQuery("SELECT name FROM companies WHERE name = 'Beta LLC'")
      expect(exactMatch.name).toBe('Beta LLC')

      const orderBy = await executeQuery('SELECT name FROM companies ORDER BY name LIMIT 1')
      expect(orderBy.name).toBe('Acme Corp')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full indexed-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: Application configured with representative indexed fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'email', type: 'email', indexed: true },
              { name: 'created_at', type: 'datetime', indexed: true },
              { name: 'notes', type: 'long-text', indexed: false },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO data (email, created_at, notes) VALUES ('test@example.com', '2024-01-01 10:00:00', 'Some notes')",
      ])

      // WHEN/THEN: Streamlined workflow testing integration points
      const emailIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname LIKE '%email%'"
      )
      expect(emailIndex.count).toBeGreaterThan(0)

      const timestampIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname LIKE '%created_at%'"
      )
      expect(timestampIndex.count).toBeGreaterThan(0)

      const noNotesIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname LIKE '%notes%'"
      )
      expect(noNotesIndex.count).toBe(0)
    }
  )
})
