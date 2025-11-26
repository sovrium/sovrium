/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Long Text Field
 *
 * Source: specs/app/tables/field-types/long-text-field/long-text-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Long Text Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-LONG-TEXT-001: should create PostgreSQL TEXT column with unlimited length when table configuration has long-text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with long-text field 'description'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_articles',
            name: 'articles',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'description', type: 'long-text' },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL TEXT column is created (unlimited length)
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='articles' AND column_name='description'"
      )
      expect(columnInfo).toEqual({
        column_name: 'description',
        data_type: 'text',
        character_maximum_length: null,
        is_nullable: 'YES',
      })

      const multiLineInsert = await executeQuery(
        "INSERT INTO articles (description) VALUES ('Line 1\nLine 2\nLine 3') RETURNING description"
      )
      expect(multiLineInsert.description).toBe('Line 1\nLine 2\nLine 3')
    }
  )

  test.fixme(
    'APP-FIELD-LONG-TEXT-002: should accept unlimited length without truncation when inserting text exceeding VARCHAR(255) limit',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'posts' with long-text field 'content'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_posts',
            name: 'posts',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'content', type: 'long-text' },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: insert text exceeding VARCHAR(255) limit (500+ characters)
      // THEN: TEXT column accepts unlimited length without truncation
      const dataTypeCheck = await executeQuery(
        "SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name='posts' AND column_name='content'"
      )
      expect(dataTypeCheck).toEqual({
        data_type: 'text',
        character_maximum_length: null,
      })

      const largeTextInsert = await executeQuery(
        "INSERT INTO posts (content) VALUES ('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.') RETURNING LENGTH(content) as length"
      )
      expect(largeTextInsert.length).toBe(445)
    }
  )

  test.fixme(
    'APP-FIELD-LONG-TEXT-003: should reject NULL value when table has required long-text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'comments' with required long-text field 'body'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_comments',
            name: 'comments',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'body', type: 'long-text', required: true },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required body
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='comments' AND column_name='body'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO comments (body) VALUES ('Great article!') RETURNING body"
      )
      expect(validInsert.body).toBe('Great article!')

      await expect(executeQuery('INSERT INTO comments (body) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-LONG-TEXT-FIELD-004: should create btree index for text search performance when long-text field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with long-text field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_pages',
            name: 'pages',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'content', type: 'long-text', required: true, indexed: true },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: index is created on the text field
      // THEN: PostgreSQL btree index exists for text search performance
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pages_content'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_pages_content',
        tablename: 'pages',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pages_content'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_pages_content ON public.pages USING btree (content)'
      )
    }
  )

  test.fixme(
    'APP-LONG-TEXT-FIELD-005: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with long-text field 'notes' and default value 'No notes'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_projects',
            name: 'projects',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'notes', type: 'long-text', default: 'No notes' },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: row inserted without providing notes value
      // THEN: PostgreSQL applies DEFAULT value 'No notes'
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='projects' AND column_name='notes'"
      )
      expect(defaultCheck.column_default).toBe("'No notes'::text")

      const defaultInsert = await executeQuery(
        'INSERT INTO projects (id) VALUES (DEFAULT) RETURNING notes'
      )
      expect(defaultInsert.notes).toBe('No notes')

      const explicitInsert = await executeQuery(
        "INSERT INTO projects (notes) VALUES ('Custom notes here') RETURNING notes"
      )
      expect(explicitInsert.notes).toBe('Custom notes here')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-LONG-TEXT-REGRESSION-001: user can complete full long-text-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative long-text field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', required: true },
              {
                name: 'long_text_field',
                type: 'long-text',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='long_text_field'"
      )
      expect(columnInfo.data_type).toBe('text')
      expect(columnInfo.character_maximum_length).toBeNull()
      expect(columnInfo.is_nullable).toBe('NO')

      // Test large text insertion
      const largeText = 'A'.repeat(1000)
      const insertResult = await executeQuery(
        `INSERT INTO data (long_text_field) VALUES ('${largeText}') RETURNING LENGTH(long_text_field) as length`
      )
      expect(insertResult.length).toBe(1000)
    }
  )
})
