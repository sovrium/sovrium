/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rich Text Field
 *
 * Source: src/domain/models/app/table/field-types/rich-text-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rich Text Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-001: should create PostgreSQL TEXT column for markdown/rich text storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'posts',
            fields: [{ id: 1, name: 'content', type: 'rich-text' }],
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='posts' AND column_name='content'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('content')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('text')

      // WHEN: querying the database
      const markdownText = await executeQuery(
        "INSERT INTO posts (content) VALUES ('# Heading\n\n**Bold** and *italic* text') RETURNING content"
      )
      // THEN: assertion
      expect(markdownText.content).toBe('# Heading\n\n**Bold** and *italic* text')

      // WHEN: querying the database
      const longText = await executeQuery(
        "INSERT INTO posts (content) VALUES (REPEAT('Lorem ipsum ', 1000)) RETURNING LENGTH(content) as length"
      )
      // THEN: assertion
      expect(longText.length).toBe(12_000)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-002: should enforce maximum length via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'articles',
            fields: [{ id: 1, name: 'summary', type: 'rich-text', maxLength: 500 }],
          },
        ],
      })

      // WHEN: querying the database
      const withinLimit = await executeQuery(
        "INSERT INTO articles (summary) VALUES (REPEAT('a', 500)) RETURNING LENGTH(summary) as length"
      )
      // THEN: assertion
      expect(withinLimit.length).toBe(500)

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO articles (summary) VALUES (REPEAT('a', 501))")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-003: should support full-text search with GIN index',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'pages',
            fields: [{ id: 1, name: 'body', type: 'rich-text', fullTextSearch: true }],
          },
        ],
      })

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pages_body_fulltext'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_pages_body_fulltext')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('pages')

      // WHEN: querying the database
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pages_body_fulltext'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        "CREATE INDEX idx_pages_body_fulltext ON public.pages USING gin (to_tsvector('english'::regconfig, body))"
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-004: should enable full-text search with to_tsvector and to_tsquery',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'comments',
            fields: [{ id: 1, name: 'message', type: 'rich-text' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO comments (message) VALUES ('This is a great product!'), ('I love the design and features'), ('Not happy with the service')"
      )

      // WHEN: querying the database
      const productSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM comments WHERE to_tsvector('english', message) @@ to_tsquery('english', 'product')"
      )
      // THEN: assertion
      expect(productSearch.count).toBe('1')

      // WHEN: querying the database
      const orSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM comments WHERE to_tsvector('english', message) @@ to_tsquery('english', 'design | service')"
      )
      // THEN: assertion
      expect(orSearch.count).toBe('2')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-005: should enforce NOT NULL and UNIQUE constraints',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'documents',
            fields: [{ id: 1, name: 'slug', type: 'rich-text', required: true, unique: true }],
          },
        ],
      })

      // WHEN: executing query
      await executeQuery("INSERT INTO documents (slug) VALUES ('my-first-document')")

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='documents' AND column_name='slug'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // WHEN: querying the database
      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='documents' AND constraint_type='UNIQUE' AND constraint_name LIKE '%slug%'"
      )
      // THEN: assertion
      expect(uniqueCount.count).toBe('1')

      // THEN: assertion
      await expect(
        executeQuery("INSERT INTO documents (slug) VALUES ('my-first-document')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RICH-TEXT-REGRESSION: user can complete full rich-text-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with rich-text fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'content', type: 'rich-text' },
              { id: 2, name: 'summary', type: 'rich-text', maxLength: 500 },
              { id: 3, name: 'body', type: 'rich-text', fullTextSearch: true },
              { id: 4, name: 'message', type: 'rich-text' },
              { id: 5, name: 'slug', type: 'rich-text', required: true, unique: true },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-RICH-TEXT-001: Creates PostgreSQL TEXT column for markdown/rich text', async () => {
        // WHEN: querying column info for rich-text field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='data' AND column_name='content'"
        )
        // THEN: TEXT column is created
        expect(columnInfo.column_name).toBe('content')
        expect(columnInfo.data_type).toBe('text')

        // WHEN: inserting markdown text
        const markdownText = await executeQuery(
          "INSERT INTO data (content, slug) VALUES ('# Heading\n\n**Bold** and *italic* text', 'doc-1') RETURNING content"
        )
        // THEN: markdown text is stored correctly
        expect(markdownText.content).toBe('# Heading\n\n**Bold** and *italic* text')

        // WHEN: inserting long text
        const longText = await executeQuery(
          "INSERT INTO data (content, slug) VALUES (REPEAT('Lorem ipsum ', 1000), 'doc-2') RETURNING LENGTH(content) as length"
        )
        // THEN: long text is stored correctly
        expect(longText.length).toBe(12_000)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RICH-TEXT-002: Enforces maximum length via CHECK constraint', async () => {
        // WHEN: inserting text within limit
        const withinLimit = await executeQuery(
          "INSERT INTO data (summary, slug) VALUES (REPEAT('a', 500), 'doc-3') RETURNING LENGTH(summary) as length"
        )
        // THEN: text within limit is stored
        expect(withinLimit.length).toBe(500)

        // WHEN: attempting to insert text exceeding limit
        // THEN: CHECK constraint rejects insertion
        await expect(
          executeQuery("INSERT INTO data (summary, slug) VALUES (REPEAT('a', 501), 'doc-4')")
        ).rejects.toThrow(/violates check constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RICH-TEXT-003: Supports full-text search with GIN index', async () => {
        // WHEN: checking for GIN index on full-text search field
        const indexInfo = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_data_body_fulltext'"
        )
        // THEN: GIN index exists
        expect(indexInfo.indexname).toBe('idx_data_body_fulltext')
        expect(indexInfo.tablename).toBe('data')

        // WHEN: querying index definition
        const indexDef = await executeQuery(
          "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_data_body_fulltext'"
        )
        // THEN: index uses GIN with tsvector
        expect(indexDef.indexdef).toBe(
          "CREATE INDEX idx_data_body_fulltext ON public.data USING gin (to_tsvector('english'::regconfig, body))"
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-RICH-TEXT-004: Enables full-text search with to_tsvector and to_tsquery', async () => {
        // WHEN: inserting messages for search
        await executeQuery(
          "INSERT INTO data (message, slug) VALUES ('This is a great product!', 'doc-5'), ('I love the design and features', 'doc-6'), ('Not happy with the service', 'doc-7')"
        )

        // WHEN: searching for 'product'
        const productSearch = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE to_tsvector('english', message) @@ to_tsquery('english', 'product')"
        )
        // THEN: one match found
        expect(productSearch.count).toBe('1')

        // WHEN: searching with OR operator
        const orSearch = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE to_tsvector('english', message) @@ to_tsquery('english', 'design | service')"
        )
        // THEN: two matches found
        expect(orSearch.count).toBe('2')
      })

      await test.step('APP-TABLES-FIELD-TYPES-RICH-TEXT-005: Enforces NOT NULL and UNIQUE constraints', async () => {
        // WHEN: checking NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='slug'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: checking UNIQUE constraint
        const uniqueCount = await executeQuery(
          "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='data' AND constraint_type='UNIQUE' AND constraint_name LIKE '%slug%'"
        )
        // THEN: UNIQUE constraint exists
        expect(uniqueCount.count).toBe('1')

        // WHEN: attempting to insert duplicate slug
        // THEN: UNIQUE constraint rejects insertion
        await expect(executeQuery("INSERT INTO data (slug) VALUES ('doc-1')")).rejects.toThrow(
          /duplicate key value violates unique constraint/
        )
      })
    }
  )
})
