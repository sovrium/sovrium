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
 * Source: src/domain/models/app/table/field-types/long-text-field.ts
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

  test(
    'APP-TABLES-FIELD-LONG-TEXT-001: should create PostgreSQL TEXT column with unlimited length when table configuration has long-text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with long-text field 'description'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'description', type: 'long-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL TEXT column is created (unlimited length)
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='articles' AND column_name='description'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('description')
      expect(columnInfo.data_type).toBe('text')
      expect(columnInfo.character_maximum_length).toBeNull()
      expect(columnInfo.is_nullable).toBe('YES')

      const multiLineInsert = await executeQuery(
        "INSERT INTO articles (description) VALUES ('Line 1\nLine 2\nLine 3') RETURNING description"
      )
      // THEN: assertion
      expect(multiLineInsert.description).toBe('Line 1\nLine 2\nLine 3')
    }
  )

  test(
    'APP-TABLES-FIELD-LONG-TEXT-002: should accept unlimited length without truncation when inserting text exceeding VARCHAR(255) limit',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'posts' with long-text field 'content'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'content', type: 'long-text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: insert text exceeding VARCHAR(255) limit (500+ characters)
      // THEN: TEXT column accepts unlimited length without truncation
      const dataTypeCheck = await executeQuery(
        "SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name='posts' AND column_name='content'"
      )
      // THEN: assertion
      expect(dataTypeCheck.data_type).toBe('text')
      expect(dataTypeCheck.character_maximum_length).toBeNull()

      const largeTextInsert = await executeQuery(
        "INSERT INTO posts (content) VALUES ('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.') RETURNING LENGTH(content) as length"
      )
      // THEN: assertion
      expect(largeTextInsert.length).toBe(445)
    }
  )

  test(
    'APP-TABLES-FIELD-LONG-TEXT-003: should reject NULL value when table has required long-text field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'comments' with required long-text field 'body'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'comments',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'body', type: 'long-text', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required body
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='comments' AND column_name='body'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO comments (body) VALUES ('Great article!') RETURNING body"
      )
      // THEN: assertion
      expect(validInsert.body).toBe('Great article!')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO comments (body) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-LONG-TEXT-004: should create btree index for text search performance when long-text field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with long-text field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'pages',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'content',
                type: 'long-text',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the text field
      // THEN: PostgreSQL btree index exists for text search performance
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_pages_content'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_pages_content')
      expect(indexExists.tablename).toBe('pages')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_pages_content'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_pages_content ON public.pages USING btree (content)'
      )
    }
  )

  test(
    'APP-TABLES-FIELD-LONG-TEXT-005: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with long-text field 'notes' and default value 'No notes'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'notes', type: 'long-text', default: 'No notes' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing notes value
      // THEN: PostgreSQL applies DEFAULT value 'No notes'
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='projects' AND column_name='notes'"
      )
      // THEN: assertion
      expect(defaultCheck.column_default).toBe("'No notes'::text")

      const defaultInsert = await executeQuery(
        'INSERT INTO projects (id) VALUES (DEFAULT) RETURNING notes'
      )
      // THEN: assertion
      expect(defaultInsert.notes).toBe('No notes')

      const explicitInsert = await executeQuery(
        "INSERT INTO projects (notes) VALUES ('Custom notes here') RETURNING notes"
      )
      // THEN: assertion
      expect(explicitInsert.notes).toBe('Custom notes here')
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-LONG-TEXT-REGRESSION: user can complete full long-text-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with long-text fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'description', type: 'long-text' },
              { id: 3, name: 'body', type: 'long-text', required: true },
              { id: 4, name: 'indexed_content', type: 'long-text', indexed: true },
              { id: 5, name: 'notes', type: 'long-text', default: 'No notes' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-LONG-TEXT-001: Creates PostgreSQL TEXT column with unlimited length', async () => {
        // WHEN: querying column info for long-text field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='description'"
        )
        // THEN: TEXT column is created with unlimited length
        expect(columnInfo.column_name).toBe('description')
        expect(columnInfo.data_type).toBe('text')
        expect(columnInfo.character_maximum_length).toBeNull()
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting multi-line text
        const multiLineInsert = await executeQuery(
          "INSERT INTO data (description, body) VALUES ('Line 1\nLine 2\nLine 3', 'required body') RETURNING description"
        )
        // THEN: multi-line text is stored correctly
        expect(multiLineInsert.description).toBe('Line 1\nLine 2\nLine 3')
      })

      await test.step('APP-TABLES-FIELD-LONG-TEXT-002: Accepts unlimited length without truncation', async () => {
        // WHEN: querying data type info
        const dataTypeCheck = await executeQuery(
          "SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name='data' AND column_name='description'"
        )
        // THEN: TEXT type with no length limit
        expect(dataTypeCheck.data_type).toBe('text')
        expect(dataTypeCheck.character_maximum_length).toBeNull()

        // WHEN: inserting text exceeding VARCHAR(255) limit
        const largeTextInsert = await executeQuery(
          "INSERT INTO data (description, body) VALUES ('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 'body text') RETURNING LENGTH(description) as length"
        )
        // THEN: full text is stored without truncation
        expect(largeTextInsert.length).toBe(445)
      })

      await test.step('APP-TABLES-FIELD-LONG-TEXT-003: Rejects NULL value when required', async () => {
        // WHEN: querying NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='body'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: inserting valid value for required field
        const validInsert = await executeQuery(
          "INSERT INTO data (body) VALUES ('Great article!') RETURNING body"
        )
        // THEN: value is stored correctly
        expect(validInsert.body).toBe('Great article!')

        // WHEN: attempting to insert NULL for required field
        // THEN: NOT NULL constraint rejects insertion
        await expect(executeQuery("INSERT INTO data (body) VALUES (NULL)")).rejects.toThrow(
          /violates not-null constraint/
        )
      })

      await test.step('APP-TABLES-FIELD-LONG-TEXT-004: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed long-text field
        const indexExists = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_data_indexed_content'"
        )
        // THEN: btree index exists
        expect(indexExists.indexname).toBe('idx_data_indexed_content')
        expect(indexExists.tablename).toBe('data')

        // WHEN: querying index definition
        const indexDef = await executeQuery(
          "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_data_indexed_content'"
        )
        // THEN: index is created using btree
        expect(indexDef.indexdef).toBe(
          'CREATE INDEX idx_data_indexed_content ON public.data USING btree (indexed_content)'
        )
      })

      await test.step('APP-TABLES-FIELD-LONG-TEXT-005: Applies DEFAULT value', async () => {
        // WHEN: querying column default
        const defaultCheck = await executeQuery(
          "SELECT column_default FROM information_schema.columns WHERE table_name='data' AND column_name='notes'"
        )
        // THEN: default value is configured
        expect(defaultCheck.column_default).toBe("'No notes'::text")

        // WHEN: inserting row without providing notes value
        const defaultInsert = await executeQuery(
          "INSERT INTO data (body) VALUES ('test body') RETURNING notes"
        )
        // THEN: DEFAULT value is applied
        expect(defaultInsert.notes).toBe('No notes')

        // WHEN: inserting with explicit value
        const explicitInsert = await executeQuery(
          "INSERT INTO data (body, notes) VALUES ('test body 2', 'Custom notes here') RETURNING notes"
        )
        // THEN: explicit value overrides default
        expect(explicitInsert.notes).toBe('Custom notes here')
      })
    }
  )
})
