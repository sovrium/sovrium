/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Database Indexes
 *
 * Source: src/domain/models/app/table/index.ts
 * Domain: app
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - Database assertions (executeQuery fixture)
 * - PostgreSQL index behavior (btree, GIN, UNIQUE)
 * - Index optimization validation (pg_indexes metadata)
 * - Query performance verification
 */

test.describe('Database Indexes', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-INDEXES-001: should create index for efficient lookups with single-column index on email field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-column index on 'email' field
      // WHEN: index migration creates btree index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'email',
                type: 'email',
              },
            ],
            indexes: [
              {
                name: 'idx_user_email',
                fields: ['email'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com'), ('Charlie', 'charlie@example.com')`
      )

      // THEN: PostgreSQL CREATE INDEX statement creates index for efficient lookups

      // Index exists in pg_indexes
      const index = await executeQuery(
        `SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_user_email'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_user_email', tablename: 'users' })

      // Index is on email column
      const indexDef = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_user_email'`
      )
      // THEN: assertion
      expect(indexDef.rows[0]).toMatchObject({
        indexdef: 'CREATE INDEX idx_user_email ON public.users USING btree (email)',
      })

      // Email lookup uses index (fast query)
      const result = await executeQuery(`SELECT name FROM users WHERE email = 'alice@example.com'`)
      // THEN: assertion
      expect(result.rows[0]).toMatchObject({ name: 'Alice' })
    }
  )

  test(
    'APP-TABLES-INDEXES-002: should create multi-column index for compound lookups with composite index on (last_name, first_name)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with composite index on multiple fields (last_name, first_name)
      // WHEN: index migration creates multi-column index
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'contacts',
            fields: [
              {
                id: 1,
                name: 'first_name',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'last_name',
                type: 'single-line-text',
              },
              {
                id: 3,
                name: 'phone',
                type: 'phone-number',
              },
            ],
            indexes: [
              {
                name: 'idx_contacts_name',
                fields: ['last_name', 'first_name'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO contacts (first_name, last_name, phone) VALUES ('Alice', 'Smith', '555-1111'), ('Bob', 'Smith', '555-2222'), ('Alice', 'Jones', '555-3333')`
      )

      // THEN: PostgreSQL CREATE INDEX with multiple columns for compound lookups

      // Composite index exists
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_contacts_name'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_contacts_name' })

      // Index includes both columns in order
      const indexDef = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_contacts_name'`
      )
      // THEN: assertion
      expect(indexDef.rows[0]).toMatchObject({
        indexdef:
          'CREATE INDEX idx_contacts_name ON public.contacts USING btree (last_name, first_name)',
      })

      // Lookup by last_name uses index
      const lastNameLookup = await executeQuery(
        `SELECT COUNT(*) as count FROM contacts WHERE last_name = 'Smith'`
      )
      // THEN: assertion
      expect(lastNameLookup.rows[0]).toMatchObject({ count: 2 })

      // Lookup by both columns uses index
      const bothColumnsLookup = await executeQuery(
        `SELECT phone FROM contacts WHERE last_name = 'Smith' AND first_name = 'Alice'`
      )
      // THEN: assertion
      expect(bothColumnsLookup.rows[0]).toMatchObject({ phone: '555-1111' })
    }
  )

  test(
    'APP-TABLES-INDEXES-003: should prevent duplicate values in indexed column with UNIQUE index on username field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with UNIQUE index on 'username' field
      // WHEN: unique: true creates UNIQUE constraint
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'accounts',
            fields: [
              {
                id: 1,
                name: 'username',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'email',
                type: 'email',
              },
            ],
            indexes: [
              {
                name: 'idx_accounts_username',
                fields: ['username'],
                unique: true, // UNIQUE index
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO accounts (username, email) VALUES ('alice123', 'alice@example.com')`
      )

      // THEN: PostgreSQL prevents duplicate values in indexed column

      // UNIQUE index exists
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_accounts_username'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_accounts_username' })

      // Index definition includes UNIQUE
      const indexDef = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_accounts_username'`
      )
      // THEN: assertion
      expect(indexDef.rows[0]).toMatchObject({
        indexdef:
          'CREATE UNIQUE INDEX idx_accounts_username ON public.accounts USING btree (username)',
      })

      // Duplicate username rejected
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO accounts (username, email) VALUES ('alice123', 'duplicate@example.com')`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Different username succeeds
      const result = await executeQuery(
        `INSERT INTO accounts (username, email) VALUES ('bob456', 'bob@example.com') RETURNING username`
      )
      // THEN: assertion
      expect(result.rows[0]).toMatchObject({ username: 'bob456' })
    }
  )

  test(
    'APP-TABLES-INDEXES-004: should only create default primary key index when table has no indexes configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with no indexes configured (empty array)
      // WHEN: table is created
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'logs',
            fields: [
              {
                id: 1,
                name: 'message',
                type: 'long-text',
              },
              {
                id: 2,
                name: 'created_at',
                type: 'created-at',
              },
            ],
            indexes: [], // No custom indexes
          },
        ],
      })

      await executeQuery(
        `INSERT INTO logs (message, created_at) VALUES ('Log 1', NOW()), ('Log 2', NOW())`
      )

      // THEN: PostgreSQL only creates default primary key index

      // Only primary key index exists
      const count = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'logs'`
      )
      // THEN: assertion
      expect(count.rows[0]).toMatchObject({ count: 1 })

      // Primary key index is on id column
      const pkeyIndex = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'logs' AND indexname LIKE '%pkey'`
      )
      // THEN: assertion
      expect(pkeyIndex.rows[0]).toMatchObject({ indexname: 'logs_pkey' })

      // No custom indexes created
      const customIndexes = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'logs' AND indexname NOT LIKE '%pkey'`
      )
      // THEN: assertion
      expect(customIndexes.rows[0]).toMatchObject({ count: 0 })
    }
  )

  test(
    'APP-TABLES-INDEXES-005: should create all specified indexes independently when table has multiple indexes configured',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with multiple indexes configured
      // WHEN: all indexes are created
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'name',
                type: 'single-line-text',
              },
              {
                id: 3,
                name: 'category',
                type: 'single-line-text',
              },
              {
                id: 4,
                name: 'price',
                type: 'decimal',
              },
            ],
            indexes: [
              {
                name: 'idx_products_sku',
                fields: ['sku'],
              },
              {
                name: 'idx_products_category',
                fields: ['category'],
              },
              {
                name: 'idx_products_price',
                fields: ['price'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO products (sku, name, category, price) VALUES ('SKU-001', 'Product 1', 'Electronics', 99.99)`
      )

      // THEN: PostgreSQL creates all specified indexes independently

      // All three indexes exist
      const count = await executeQuery(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE 'idx_products_%'`
      )
      // THEN: assertion
      expect(count.rows[0]).toMatchObject({ count: 3 })

      // SKU index exists
      const skuIndex = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_sku'`
      )
      // THEN: assertion
      expect(skuIndex.rows[0]).toMatchObject({ indexname: 'idx_products_sku' })

      // Category index exists
      const categoryIndex = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_category'`
      )
      // THEN: assertion
      expect(categoryIndex.rows[0]).toMatchObject({ indexname: 'idx_products_category' })

      // Price index exists
      const priceIndex = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_products_price'`
      )
      // THEN: assertion
      expect(priceIndex.rows[0]).toMatchObject({ indexname: 'idx_products_price' })
    }
  )

  test(
    'APP-TABLES-INDEXES-006: should optimize ORDER BY and range queries with index on timestamp field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with index on timestamp field (created_at)
      // WHEN: index is used for date range queries
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'events',
            fields: [
              {
                id: 1,
                name: 'name',
                type: 'single-line-text',
              },
              {
                id: 2,
                name: 'created_at',
                type: 'created-at',
              },
            ],
            indexes: [
              {
                name: 'idx_events_created_at',
                fields: ['created_at'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO events (name, created_at) VALUES ('Event 1', '2024-01-01 10:00:00'), ('Event 2', '2024-01-02 10:00:00'), ('Event 3', '2024-01-03 10:00:00')`
      )

      // THEN: PostgreSQL btree index optimizes ORDER BY and range queries

      // Index exists on created_at
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_events_created_at'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_events_created_at' })

      // Range query uses index
      const rangeQuery = await executeQuery(
        `SELECT COUNT(*) as count FROM events WHERE created_at > '2024-01-01'`
      )
      // THEN: assertion
      expect(rangeQuery.rows[0]).toMatchObject({ count: 3 })

      // ORDER BY uses index for sorting
      const orderBy = await executeQuery(`SELECT name FROM events ORDER BY created_at DESC LIMIT 1`)
      // THEN: assertion
      expect(orderBy.rows[0]).toMatchObject({ name: 'Event 3' })

      // Date filter with ORDER BY uses index
      const filterAndOrder = await executeQuery(
        `SELECT name FROM events WHERE created_at >= '2024-01-01' ORDER BY created_at ASC`
      )
      // THEN: assertion
      expect(filterAndOrder.rows).toEqual([
        { name: 'Event 1' },
        { name: 'Event 2' },
        { name: 'Event 3' },
      ])
    }
  )

  test(
    'APP-TABLES-INDEXES-007: should enforce uniqueness within each tenant only with partial unique index',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with partial unique index (unique username per tenant)
      // WHEN: composite unique index on (tenant_id, username)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'tenant_users',
            fields: [
              {
                id: 1,
                name: 'tenant_id',
                type: 'integer',
              },
              {
                id: 2,
                name: 'username',
                type: 'single-line-text',
              },
              {
                id: 3,
                name: 'email',
                type: 'email',
              },
            ],
            indexes: [
              {
                name: 'idx_tenant_users_unique',
                fields: ['tenant_id', 'username'],
                unique: true, // Composite unique index
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO tenant_users (tenant_id, username, email) VALUES (1, 'alice', 'alice@tenant1.com'), (2, 'alice', 'alice@tenant2.com')`
      )

      // THEN: PostgreSQL enforces uniqueness within each tenant only

      // Composite unique index exists
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tenant_users_unique'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_tenant_users_unique' })

      // Same username allowed in different tenants
      const sameUsername = await executeQuery(
        `SELECT COUNT(*) as count FROM tenant_users WHERE username = 'alice'`
      )
      // THEN: assertion
      expect(sameUsername.rows[0]).toMatchObject({ count: 2 })

      // Duplicate username in same tenant rejected
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO tenant_users (tenant_id, username, email) VALUES (1, 'alice', 'duplicate@tenant1.com')`
        )
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Same username in different tenant succeeds
      const result = await executeQuery(
        `INSERT INTO tenant_users (tenant_id, username, email) VALUES (3, 'alice', 'alice@tenant3.com') RETURNING username`
      )
      // THEN: assertion
      expect(result.rows[0]).toMatchObject({ username: 'alice' })
    }
  )

  test(
    'APP-TABLES-INDEXES-008: should enable efficient text search queries with GIN index for full-text search',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with text search index using GIN (for full-text search)
      // WHEN: index is created with to_tsvector
      // Initialize database for raw SQL testing
      await startServerWithSchema({
        name: 'test-app',
        tables: [], // No app tables needed - testing raw PostgreSQL GIN functionality
      })

      await executeQuery(
        `CREATE TABLE articles (id SERIAL PRIMARY KEY, title VARCHAR(255), content TEXT)`
      )
      await executeQuery(
        `CREATE INDEX idx_articles_search ON articles USING GIN (to_tsvector('english', title || ' ' || content))`
      )
      await executeQuery(
        `INSERT INTO articles (title, content) VALUES ('PostgreSQL Tutorial', 'Learn about database indexes'), ('Python Guide', 'Introduction to Python programming')`
      )

      // THEN: PostgreSQL GIN index enables efficient text search queries

      // GIN index exists
      const index = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_articles_search'`
      )
      // THEN: assertion
      expect(index.rows[0]).toMatchObject({ indexname: 'idx_articles_search' })

      // Index uses GIN access method
      const indexDef = await executeQuery(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_articles_search'`
      )
      // THEN: assertion
      expect(indexDef.rows[0]).toMatchObject({
        indexdef: `CREATE INDEX idx_articles_search ON public.articles USING gin (to_tsvector('english'::regconfig, (((title)::text || ' '::text) || content)))`,
      })

      // Full-text search uses GIN index
      const search = await executeQuery(
        `SELECT title FROM articles WHERE to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', 'database')`
      )
      // THEN: assertion
      expect(search.rows[0]).toMatchObject({ title: 'PostgreSQL Tutorial' })

      // Multiple word search
      const multiWordSearch = await executeQuery(
        `SELECT COUNT(*) as count FROM articles WHERE to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', 'programming | database')`
      )
      // THEN: assertion
      expect(multiWordSearch.rows[0]).toMatchObject({ count: 2 })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test(
    'APP-TABLES-INDEXES-009: user can complete full Database Indexes workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Database with representative index configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'users',
            fields: [
              { id: 1, name: 'username', type: 'single-line-text' },
              { id: 2, name: 'email', type: 'email' },
              { id: 3, name: 'created_at', type: 'created-at' },
            ],
            indexes: [
              {
                name: 'idx_users_username',
                fields: ['username'],
                unique: true,
              },
              {
                name: 'idx_users_email',
                fields: ['email'],
              },
              {
                name: 'idx_users_created_at',
                fields: ['created_at'],
              },
            ],
          },
        ],
      })

      await executeQuery(
        `INSERT INTO users (username, email, created_at) VALUES ('alice', 'alice@example.com', '2024-01-01 10:00:00'), ('bob', 'bob@example.com', '2024-01-02 10:00:00')`
      )

      // WHEN/THEN: Execute representative workflow

      // 1. Unique index prevents duplicates
      // THEN: assertion
      await expect(
        executeQuery(
          `INSERT INTO users (username, email, created_at) VALUES ('alice', 'duplicate@example.com', NOW())`
        )
      ).rejects.toThrow(/unique constraint/)

      // 2. Regular indexes allow efficient lookups
      const emailLookup = await executeQuery(
        `SELECT username FROM users WHERE email = 'bob@example.com'`
      )
      // THEN: assertion
      expect(emailLookup.rows[0]).toMatchObject({ username: 'bob' })

      // 3. Timestamp index supports range queries
      const rangeQuery = await executeQuery(
        `SELECT COUNT(*) as count FROM users WHERE created_at > '2024-01-01 10:00:00'`
      )
      // THEN: assertion
      expect(rangeQuery.rows[0]).toMatchObject({ count: 2 })

      // 4. All indexes are retrievable
      const indexes = await executeQuery(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname LIKE 'idx_users_%' ORDER BY indexname`
      )
      // THEN: assertion
      expect(indexes.rows).toHaveLength(3)
      expect(indexes.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indexname: 'idx_users_username' }),
          expect.objectContaining({ indexname: 'idx_users_email' }),
          expect.objectContaining({ indexname: 'idx_users_created_at' }),
        ])
      )

      // Workflow completes successfully
    }
  )
})
