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
 * Source: src/domain/models/app/table/field-types/base-field.ts
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

  test(
    'APP-TABLES-FIELD-INDEXED-001: should create btree index optimizing queries when field has indexed: true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(indexCheck.indexname).toBe('idx_users_email')
      expect(indexCheck.tablename).toBe('users')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_users_email'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toContain('USING btree (email)')

      const lookup = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE email = 'alice@example.com'"
      )
      // THEN: assertion
      expect(lookup.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-INDEXED-002: should not create index for field when field has indexed: false (default)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: field with indexed: false (default)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'description', type: 'long-text', indexed: false },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(noIndex.count).toBe(0)

      const onlyPrimaryKey = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename='products'"
      )
      // THEN: assertion
      expect(onlyPrimaryKey.indexname).toBe('products_pkey')

      const sequentialScan = await executeQuery(
        "SELECT name FROM products WHERE description LIKE '%Description%'"
      )
      // THEN: assertion
      expect(sequentialScan.name).toBe('Product 1')
    }
  )

  test(
    'APP-TABLES-FIELD-INDEXED-003: should optimize date range and ORDER BY queries when timestamp field has indexed: true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: timestamp field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'events',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text' },
              { id: 3, name: 'occurred_at', type: 'datetime', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_events_occurred_at')

      const rangeQuery = await executeQuery(
        "SELECT COUNT(*) as count FROM events WHERE occurred_at > '2024-01-01'"
      )
      // THEN: assertion
      expect(rangeQuery.count).toBe(3)

      const orderBy = await executeQuery(
        'SELECT name FROM events ORDER BY occurred_at DESC LIMIT 1'
      )
      // THEN: assertion
      expect(orderBy.name).toBe('Event 3')
    }
  )

  test(
    'APP-TABLES-FIELD-INDEXED-004: should use index for WHERE, JOIN, and ORDER BY operations when frequently queried field has indexed: true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: frequently queried field with indexed: true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'orders',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'customer_id', type: 'integer', indexed: true },
              { id: 3, name: 'status', type: 'single-line-text' },
              { id: 4, name: 'total', type: 'decimal' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_orders_customer_id')

      const filterQuery = await executeQuery(
        'SELECT COUNT(*) as count FROM orders WHERE customer_id = 1'
      )
      // THEN: assertion
      expect(filterQuery.count).toBe(2)

      const groupedQuery = await executeQuery(
        'SELECT customer_id, COUNT(*) as order_count FROM orders GROUP BY customer_id ORDER BY customer_id'
      )
      // THEN: assertion
      expect(groupedQuery.rows).toEqual([
        { customer_id: 1, order_count: 2 },
        { customer_id: 2, order_count: 1 },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-INDEXED-005: should improve prefix searches when text field has indexed: true for LIKE queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: text field with indexed: true for LIKE queries
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'companies',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'name', type: 'single-line-text', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_companies_name')

      const prefixSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM companies WHERE name LIKE 'Acme%'"
      )
      // THEN: assertion
      expect(prefixSearch.count).toBe(2)

      const exactMatch = await executeQuery("SELECT name FROM companies WHERE name = 'Beta LLC'")
      // THEN: assertion
      expect(exactMatch.name).toBe('Beta LLC')

      const orderBy = await executeQuery('SELECT name FROM companies ORDER BY name LIMIT 1')
      // THEN: assertion
      expect(orderBy.name).toBe('Acme Corp')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-INDEXED-006: user can complete full indexed-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative indexed fields
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'email', type: 'email', indexed: true },
              { id: 3, name: 'created_at', type: 'datetime', indexed: true },
              { id: 4, name: 'notes', type: 'long-text', indexed: false },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
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
      // THEN: assertion
      expect(emailIndex.count).toBeGreaterThan(0)

      const timestampIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname LIKE '%created_at%'"
      )
      // THEN: assertion
      expect(timestampIndex.count).toBeGreaterThan(0)

      const noNotesIndex = await executeQuery(
        "SELECT COUNT(*) as count FROM pg_indexes WHERE tablename='data' AND indexname LIKE '%notes%'"
      )
      // THEN: assertion
      expect(noNotesIndex.count).toBe(0)
    }
  )
})
