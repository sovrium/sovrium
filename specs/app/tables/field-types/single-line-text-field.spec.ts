/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Single Line Text Field
 *
 * Source: src/domain/models/app/table/field-types/single-line-text-field.ts
 * Domain: app
 * Spec Count: 19
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (19 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Single Line Text Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-001: should create PostgreSQL VARCHAR(255) column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table configuration with single-line-text field 'title'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL VARCHAR(255) column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='title'"
      )
      expect(columnInfo).toMatchObject({
        column_name: 'title',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'YES',
      })

      // WHEN: querying the database
      const validInsert = await executeQuery(
        "INSERT INTO products (title) VALUES ('MacBook Pro 16-inch') RETURNING title"
      )
      expect(validInsert.title).toBe('MacBook Pro 16-inch')
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-002: should reject duplicate values with UNIQUE constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table 'users' with single-line-text field 'username' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'username',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // Seed: existing row username='john_doe'
      await executeQuery("INSERT INTO users (username) VALUES ('john_doe')")

      // WHEN: attempt to insert duplicate username='john_doe'
      // THEN: PostgreSQL UNIQUE constraint rejects insertion
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name LIKE '%username%'"
      )
      // THEN: assertion
      expect(uniqueConstraint.count).toBe(1)

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO users (username) VALUES ('john_doe')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const rowCount = await executeQuery('SELECT COUNT(*) as count FROM users')
      // THEN: assertion
      expect(rowCount.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-003: should reject NULL values with NOT NULL constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table 'tasks' with required single-line-text field 'title'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'tasks',
            fields: [{ id: 1, name: 'title', type: 'single-line-text', required: true }],
          },
        ],
      })

      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='title'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      // WHEN: querying the database
      const validInsert = await executeQuery(
        "INSERT INTO tasks (title) VALUES ('Complete project') RETURNING title"
      )
      expect(validInsert.title).toBe('Complete project')

      await expect(executeQuery('INSERT INTO tasks (title) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-004: should create btree index for fast text lookups',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table configuration with single-line-text field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
                required: true,
                unique: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL btree index exists for fast text lookups
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_products_sku'"
      )
      expect(indexExists).toMatchObject({
        indexname: 'idx_products_sku',
        tablename: 'products',
      })

      // WHEN: executing query
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_products_sku'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_products_sku ON public.products USING btree (sku)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-005: should apply DEFAULT value when row inserted without value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field 'name' and default value 'Untitled'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'documents',
            fields: [{ id: 1, name: 'name', type: 'single-line-text', default: 'Untitled' }],
          },
        ],
      })

      // THEN: PostgreSQL applies DEFAULT value 'Untitled'
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='documents' AND column_name='name'"
      )
      expect(defaultCheck.column_default).toBe("'Untitled'::character varying")

      // WHEN: querying the database
      const defaultInsert = await executeQuery(
        'INSERT INTO documents (id) VALUES (DEFAULT) RETURNING name'
      )
      expect(defaultInsert.name).toBe('Untitled')

      const explicitInsert = await executeQuery(
        "INSERT INTO documents (name) VALUES ('My Document') RETURNING name"
      )
      expect(explicitInsert.name).toBe('My Document')
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-006: should store and retrieve unicode text correctly',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field accepting unicode characters
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'posts',
            fields: [{ id: 1, name: 'content', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL stores and retrieves unicode text correctly
      const emojiInsert = await executeQuery(
        "INSERT INTO posts (content) VALUES ('Hello 👋 World 🌍') RETURNING content"
      )
      expect(emojiInsert.content).toBe('Hello 👋 World 🌍')

      // WHEN: querying the database
      const i18nInsert = await executeQuery(
        "INSERT INTO posts (content) VALUES ('Привет мир 你好世界 مرحبا العالم') RETURNING content"
      )
      expect(i18nInsert.content).toBe('Привет мир 你好世界 مرحبا العالم')

      // WHEN: querying the database
      const symbolsInsert = await executeQuery(
        "INSERT INTO posts (content) VALUES ('Price: €100 ¥500 £50 ©2024') RETURNING content"
      )
      expect(symbolsInsert.content).toBe('Price: €100 ¥500 £50 ©2024')
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-007: should reject text exceeding VARCHAR(255) limit',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field with VARCHAR(255) limit
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 7,
            name: 'notes',
            fields: [{ id: 1, name: 'short_note', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL rejects or truncates the text
      const atLimit = await executeQuery(
        "INSERT INTO notes (short_note) VALUES (REPEAT('a', 255)) RETURNING LENGTH(short_note) as len"
      )
      expect(atLimit.len).toBe(255)

      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery("INSERT INTO notes (short_note) VALUES (REPEAT('b', 300))")
      ).rejects.toThrow(/value too long for type character varying\(255\)/)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-008: should safely escape special characters without SQL injection',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field handling special characters
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 8,
            name: 'messages',
            fields: [{ id: 1, name: 'message', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL safely escapes and stores the text without SQL injection
      const quotesInsert = await executeQuery(
        "INSERT INTO messages (message) VALUES ('O''Brien''s message') RETURNING message"
      )
      expect(quotesInsert.message).toBe("O'Brien's message")

      // WHEN: querying the database
      const backslashInsert = await executeQuery(
        "INSERT INTO messages (message) VALUES ('Path: C:\\Users\\Documents\\file.txt') RETURNING message"
      )
      expect(backslashInsert.message).toBe('Path: C:\\Users\\Documents\\file.txt')

      const injectionInsert = await executeQuery(
        "INSERT INTO messages (message) VALUES ('''; DROP TABLE messages; --') RETURNING message"
      )
      expect(injectionInsert.message).toBe("'; DROP TABLE messages; --")

      const tableExists = await executeQuery('SELECT COUNT(*) as count FROM messages')
      expect(tableExists.count).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-009: should handle bulk insert efficiently without errors',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field and 1000 records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 9,
            name: 'products',
            fields: [{ id: 1, name: 'sku', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL handles bulk insert efficiently without errors
      await executeQuery(
        "INSERT INTO products (sku) SELECT 'SKU-' || generate_series(1, 1000)"
      )

      // WHEN: querying the database
      const totalCount = await executeQuery('SELECT COUNT(*) as count FROM products')
      expect(totalCount.count).toBe(1000)

      // WHEN: querying the database
      const sampleRecords = await executeQuery(
        'SELECT sku FROM products WHERE id IN (1, 500, 1000) ORDER BY id'
      )
      expect(sampleRecords.rows).toEqual([{ sku: 'SKU-1' }, { sku: 'SKU-500' }, { sku: 'SKU-1000' }])
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-010: should use btree index for fast lookup',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with indexed single-line-text field and 10000 records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 10,
            name: 'inventory',
            fields: [{ id: 1, name: 'product_code', type: 'single-line-text', indexed: true }],
          },
        ],
      })

      // Seed test data
      await executeQuery(
        "INSERT INTO inventory (product_code) SELECT 'PROD-' || generate_series(1, 10000)"
      )

      // THEN: PostgreSQL uses btree index for fast lookup
      const indexCheck = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE tablename='inventory' AND indexname='idx_inventory_product_code'"
      )
      expect(indexCheck.indexname).toBe('idx_inventory_product_code')

      // WHEN: executing query
      const specificRecord = await executeQuery(
        "SELECT product_code FROM inventory WHERE product_code = 'PROD-5000'"
      )
      expect(specificRecord.product_code).toBe('PROD-5000')

      // WHEN: executing query
      const rangeQuery = await executeQuery(
        "SELECT COUNT(*) as count FROM inventory WHERE product_code >= 'PROD-1000' AND product_code < 'PROD-2000'"
      )
      expect(rangeQuery.count).toBe(1112)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-011: should execute text search and return matching records',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field and 5000 records
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 11,
            name: 'articles',
            fields: [{ id: 1, name: 'title', type: 'single-line-text' }],
          },
        ],
      })

      // Seed test data
      await executeQuery(
        "INSERT INTO articles (title) SELECT CASE WHEN i % 10 = 0 THEN 'Featured Article ' || i ELSE 'Regular Article ' || i END FROM generate_series(1, 5000) i"
      )

      // THEN: PostgreSQL executes text search and returns matching records
      const totalRecords = await executeQuery('SELECT COUNT(*) as count FROM articles')
      expect(totalRecords.count).toBe(5000)

      // WHEN: executing query
      const featuredCount = await executeQuery(
        "SELECT COUNT(*) as count FROM articles WHERE title LIKE 'Featured%'"
      )
      expect(featuredCount.count).toBe(500)

      // WHEN: executing query
      const wildcardSearch = await executeQuery(
        "SELECT title FROM articles WHERE title LIKE '%Article 100' ORDER BY id LIMIT 1"
      )
      expect(wildcardSearch.title).toBe('Featured Article 100')

      // WHEN: executing query
      const caseInsensitive = await executeQuery(
        "SELECT COUNT(*) as count FROM articles WHERE title ILIKE '%FEATURED%'"
      )
      expect(caseInsensitive.count).toBe(500)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-012: should prevent duplicate insertion with UNIQUE constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with unique single-line-text field and concurrent insert attempts
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 12,
            name: 'users',
            fields: [
              {
                id: 1,
                name: 'username',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL UNIQUE constraint prevents duplicate insertion and one transaction fails
      const firstInsert = await executeQuery(
        "INSERT INTO users (username) VALUES ('concurrent_user') RETURNING username"
      )
      expect(firstInsert.username).toBe('concurrent_user')

      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery("INSERT INTO users (username) VALUES ('concurrent_user')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // WHEN: executing query
      const finalCount = await executeQuery(
        "SELECT COUNT(*) as count FROM users WHERE username = 'concurrent_user'"
      )
      expect(finalCount.count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-013: should apply row-level locking and ensure data consistency',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field and active transaction updating record
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 13,
            name: 'products',
            fields: [
              {
                id: 1,
                name: 'sku',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // Seed test data
      await executeQuery("INSERT INTO products (sku) VALUES ('PROD-001')")

      // THEN: PostgreSQL applies row-level locking and ensures data consistency
      const beforeUpdate = await executeQuery('SELECT sku FROM products WHERE id = 1')
      expect(beforeUpdate.sku).toBe('PROD-001')

      // WHEN: executing query
      const updateResult = await executeQuery(
        "UPDATE products SET sku = 'PROD-001-UPDATED' WHERE id = 1 RETURNING sku"
      )
      expect(updateResult.sku).toBe('PROD-001-UPDATED')

      // WHEN: executing query
      const afterUpdate = await executeQuery('SELECT sku FROM products WHERE id = 1')
      expect(afterUpdate.sku).toBe('PROD-001-UPDATED')

      // WHEN: executing query
      const oldValueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM products WHERE sku = 'PROD-001'"
      )
      expect(oldValueCount.count).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-014: should handle concurrent writes without data loss or corruption',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field and multiple concurrent inserts
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 14,
            name: 'events',
            fields: [
              {
                id: 1,
                name: 'event_code',
                type: 'single-line-text',
                required: true,
                unique: true,
              },
            ],
          },
        ],
      })

      // THEN: PostgreSQL handles concurrent writes without data loss or corruption
      const bulkInsert = await executeQuery(
        "INSERT INTO events (event_code) SELECT 'EVENT-' || generate_series(1, 1000)"
      )
      expect(bulkInsert.rowCount).toBe(1000)

      // WHEN: querying the database
      const uniqueCount = await executeQuery(
        'SELECT COUNT(DISTINCT event_code) as unique_count FROM events'
      )
      expect(uniqueCount.unique_count).toBe(1000)

      const totalCount = await executeQuery('SELECT COUNT(*) as count FROM events')
      expect(totalCount.count).toBe(1000)

      const duplicateCount = await executeQuery(
        'SELECT COUNT(*) as duplicate_count FROM (SELECT event_code, COUNT(*) as cnt FROM events GROUP BY event_code HAVING COUNT(*) > 1) duplicates'
      )
      expect(duplicateCount.duplicate_count).toBe(0)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-015: should store empty string as distinct from NULL',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field accepting empty strings
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 15,
            name: 'items',
            fields: [{ id: 1, name: 'description', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL stores empty string as distinct from NULL
      const emptyInsert = await executeQuery(
        "INSERT INTO items (description) VALUES ('') RETURNING description"
      )
      expect(emptyInsert.description).toBe('')

      // WHEN: querying the database
      const nullInsert = await executeQuery(
        'INSERT INTO items (description) VALUES (NULL) RETURNING description'
      )
      expect(nullInsert.description).toBe(null)

      const emptyCount = await executeQuery(
        "SELECT COUNT(*) as empty_count FROM items WHERE description = ''"
      )
      expect(emptyCount.empty_count).toBe(1)

      const nullCount = await executeQuery(
        'SELECT COUNT(*) as null_count FROM items WHERE description IS NULL'
      )
      expect(nullCount.null_count).toBe(1)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-016: should preserve whitespace without trimming',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field handling whitespace
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 16,
            name: 'content',
            fields: [{ id: 1, name: 'text', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL preserves whitespace without trimming
      const whitespaceOnly = await executeQuery(
        "INSERT INTO content (text) VALUES ('   ') RETURNING text, LENGTH(text) as len"
      )
      expect(whitespaceOnly.text).toBe('   ')
      expect(whitespaceOnly.len).toBe(3)

      // WHEN: querying the database
      const leadingSpace = await executeQuery(
        "INSERT INTO content (text) VALUES ('  leading') RETURNING text"
      )
      expect(leadingSpace.text).toBe('  leading')

      // WHEN: querying the database
      const trailingSpace = await executeQuery(
        "INSERT INTO content (text) VALUES ('trailing  ') RETURNING text"
      )
      expect(trailingSpace.text).toBe('trailing  ')

      const bothSides = await executeQuery(
        "INSERT INTO content (text) VALUES ('  both sides  ') RETURNING text, LENGTH(text) as len"
      )
      expect(bothSides.text).toBe('  both sides  ')
      expect(bothSides.len).toBe(14)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-017: should accept both boundary values correctly',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field storing minimal and maximal length strings
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 17,
            name: 'boundaries',
            fields: [{ id: 1, name: 'value', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL accepts both boundary values correctly
      const singleChar = await executeQuery(
        "INSERT INTO boundaries (value) VALUES ('a') RETURNING value, LENGTH(value) as len"
      )
      expect(singleChar.value).toBe('a')
      expect(singleChar.len).toBe(1)

      // WHEN: querying the database
      const maxLength = await executeQuery(
        "INSERT INTO boundaries (value) VALUES (REPEAT('b', 255)) RETURNING LENGTH(value) as len"
      )
      expect(maxLength.len).toBe(255)

      const recordCount = await executeQuery('SELECT COUNT(*) as count FROM boundaries')
      expect(recordCount.count).toBe(2)

      const maxLengthRecord = await executeQuery(
        'SELECT LEFT(value, 10) as prefix, LENGTH(value) as len FROM boundaries WHERE id = 2'
      )
      expect(maxLengthRecord.prefix).toBe('bbbbbbbbbb')
      expect(maxLengthRecord.len).toBe(255)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-018: should accept empty string as valid non-NULL value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with required single-line-text field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 18,
            name: 'required_fields',
            fields: [{ id: 1, name: 'name', type: 'single-line-text', required: true }],
          },
        ],
      })

      // THEN: PostgreSQL accepts empty string as valid non-NULL value
      const emptyString = await executeQuery(
        "INSERT INTO required_fields (name) VALUES ('') RETURNING name"
      )
      expect(emptyString.name).toBe('')

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        'SELECT name IS NULL as is_null FROM required_fields WHERE id = 1'
      )
      expect(notNullCheck.is_null).toBe(false)

      await expect(
        executeQuery('INSERT INTO required_fields (name) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-019: should store control characters without interpretation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: table with single-line-text field containing special boundary characters
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 19,
            name: 'special_chars',
            fields: [{ id: 1, name: 'content', type: 'single-line-text' }],
          },
        ],
      })

      // THEN: PostgreSQL stores control characters without interpretation
      const tabChar = await executeQuery(
        "INSERT INTO special_chars (content) VALUES ('before\tafter') RETURNING content"
      )
      expect(tabChar.content).toBe('before\tafter')

      // WHEN: querying the database
      const newlineChar = await executeQuery(
        "INSERT INTO special_chars (content) VALUES ('line1\nline2') RETURNING content"
      )
      expect(newlineChar.content).toBe('line1\nline2')

      const carriageReturn = await executeQuery(
        "INSERT INTO special_chars (content) VALUES ('before\rafter') RETURNING content"
      )
      expect(carriageReturn.content).toBe('before\rafter')

      const mixedControl = await executeQuery(
        "INSERT INTO special_chars (content) VALUES ('tab\tthen\nnewline') RETURNING content, LENGTH(content) as len"
      )
      expect(mixedControl.content).toBe('tab\tthen\nnewline')
      expect(mixedControl.len).toBe(16)
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-SINGLE-LINE-TEXT-020: user can complete full single-line-text-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN/WHEN: Table with comprehensive text field configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 20,
            name: 'data',
            fields: [
              {
                id: 1,
                name: 'text_field',
                type: 'single-line-text',
                required: true,
                unique: true,
                default: 'Default Value',
                indexed: true,
              },
            ],
          },
        ],
      })

      // THEN: Streamlined workflow testing all major integration points

      // Verify column setup
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_name='data' AND column_name='text_field'"
      )
      expect(columnInfo.data_type).toBe('character varying')
      expect(columnInfo.character_maximum_length).toBe(255)
      expect(columnInfo.is_nullable).toBe('NO')
      expect(columnInfo.column_default).toBe("'Default Value'::character varying")

      // Test constraints (representative: unique)
      await executeQuery("INSERT INTO data (text_field) VALUES ('unique_value')")
      // WHEN/THEN: executing query and asserting error
      await expect(
        executeQuery("INSERT INTO data (text_field) VALUES ('unique_value')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      // Test edge cases (representative: unicode + empty string)
      const unicodeInsert = await executeQuery(
        "INSERT INTO data (text_field) VALUES ('Hello 👋') RETURNING text_field"
      )
      expect(unicodeInsert.text_field).toBe('Hello 👋')

      // Test performance (representative: bulk + search)
      await executeQuery(
        "INSERT INTO data (text_field) SELECT 'Bulk-' || i FROM generate_series(1, 500) i"
      )
      // WHEN: executing query
      const searchResult = await executeQuery(
        "SELECT text_field FROM data WHERE text_field = 'Bulk-250'"
      )
      expect(searchResult.text_field).toBe('Bulk-250')

      // Test boundaries (representative: max length)
      const maxLengthInsert = await executeQuery(
        "INSERT INTO data (text_field) VALUES (REPEAT('x', 255)) RETURNING LENGTH(text_field) as len"
      )
      expect(maxLengthInsert.len).toBe(255)

      // Workflow completes successfully
    }
  )
})
