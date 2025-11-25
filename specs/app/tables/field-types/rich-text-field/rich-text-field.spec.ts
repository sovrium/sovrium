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
 * Source: specs/app/tables/field-types/rich-text-field/rich-text-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rich Text Field', () => {
  test.fixme(
    'APP-RICH-TEXT-FIELD-001: should create PostgreSQL TEXT column for markdown/rich text storage',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery('CREATE TABLE posts (id SERIAL PRIMARY KEY, content TEXT)')

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='posts' AND column_name='content'"
      )
      expect(columnInfo.column_name).toBe('content')
      expect(columnInfo.data_type).toBe('text')

      const markdownText = await executeQuery(
        "INSERT INTO posts (content) VALUES ('# Heading\n\n**Bold** and *italic* text') RETURNING content"
      )
      expect(markdownText.content).toBe('# Heading\n\n**Bold** and *italic* text')

      const longText = await executeQuery(
        "INSERT INTO posts (content) VALUES (REPEAT('Lorem ipsum ', 1000)) RETURNING LENGTH(content) as length"
      )
      expect(longText.length).toBe(12_000)
    }
  )

  test.fixme(
    'APP-RICH-TEXT-FIELD-002: should enforce maximum length via CHECK constraint',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery(
        'CREATE TABLE articles (id SERIAL PRIMARY KEY, summary TEXT CHECK (LENGTH(summary) <= 500))'
      )

      const withinLimit = await executeQuery(
        "INSERT INTO articles (summary) VALUES (REPEAT('a', 500)) RETURNING LENGTH(summary) as length"
      )
      expect(withinLimit.length).toBe(500)

      await expect(
        executeQuery("INSERT INTO articles (summary) VALUES (REPEAT('a', 501))")
      ).rejects.toThrow(/violates check constraint/)
    }
  )

  test.fixme(
    'APP-RICH-TEXT-FIELD-003: should support full-text search with GIN index',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE pages (id SERIAL PRIMARY KEY, body TEXT)',
        "CREATE INDEX idx_pages_body_fulltext ON pages USING GIN(to_tsvector('english', body))",
      ])

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pages_body_fulltext'"
      )
      expect(indexInfo.indexname).toBe('idx_pages_body_fulltext')
      expect(indexInfo.tablename).toBe('pages')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pages_body_fulltext'"
      )
      expect(indexDef.indexdef).toBe(
        "CREATE INDEX idx_pages_body_fulltext ON public.pages USING gin (to_tsvector('english'::regconfig, body))"
      )
    }
  )

  test.fixme(
    'APP-RICH-TEXT-FIELD-004: should enable full-text search with to_tsvector and to_tsquery',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE comments (id SERIAL PRIMARY KEY, message TEXT)',
        "INSERT INTO comments (message) VALUES ('This is a great product!')",
        "INSERT INTO comments (message) VALUES ('I love the design and features')",
        "INSERT INTO comments (message) VALUES ('Not happy with the service')",
      ])

      const productSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM comments WHERE to_tsvector('english', message) @@ to_tsquery('english', 'product')"
      )
      expect(productSearch.count).toBe(1)

      const orSearch = await executeQuery(
        "SELECT COUNT(*) as count FROM comments WHERE to_tsvector('english', message) @@ to_tsquery('english', 'design | service')"
      )
      expect(orSearch.count).toBe(2)
    }
  )

  test.fixme(
    'APP-RICH-TEXT-FIELD-005: should enforce NOT NULL and UNIQUE constraints',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE documents (id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL)',
        "INSERT INTO documents (slug) VALUES ('my-first-document')",
      ])

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='documents' AND column_name='slug'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const uniqueCount = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='documents' AND constraint_type='UNIQUE' AND constraint_name LIKE '%slug%'"
      )
      expect(uniqueCount.count).toBe(1)

      await expect(
        executeQuery("INSERT INTO documents (slug) VALUES ('my-first-document')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )

  test.fixme(
    'user can complete full rich-text-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'description', type: 'rich-text', required: true },
            ],
          },
        ],
      })

      await executeQuery(
        "INSERT INTO data (description) VALUES ('# Title\n\nThis is **important** content')"
      )
      const stored = await executeQuery('SELECT description FROM data WHERE id = 1')
      expect(stored.description).toBe('# Title\n\nThis is **important** content')

      const searchResult = await executeQuery(
        "SELECT COUNT(*) as count FROM data WHERE to_tsvector('english', description) @@ to_tsquery('english', 'important')"
      )
      expect(searchResult.count).toBe(1)
    }
  )
})
