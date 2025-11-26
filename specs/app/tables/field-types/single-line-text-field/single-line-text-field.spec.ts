/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Single Line Text Field
 *
 * Source: specs/app/tables/field-types/single-line-text-field/single-line-text-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Single Line Text Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-SINGLE-LINE-TEXT-001: should create PostgreSQL VARCHAR(255) column when table configuration has single-line-text field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-line-text field 'title'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'single-line-text' },
            ],
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL VARCHAR(255) column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='title'"
      )
      expect(columnInfo).toEqual({
        column_name: 'title',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'YES',
      })

      const validInsert = await executeQuery(
        "INSERT INTO products (title) VALUES ('MacBook Pro 16-inch') RETURNING title"
      )
      expect(validInsert.title).toBe('MacBook Pro 16-inch')
    }
  )

  test.fixme(
    'APP-FIELD-SINGLE-LINE-TEXT-002: should reject duplicate username when table has single-line-text field with unique constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'users' with single-line-text field 'username' (required, unique), existing row username='john_doe'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'username', type: 'single-line-text', unique: true, required: true },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO users (username) VALUES ('john_doe')"])

      // WHEN: attempt to insert duplicate username='john_doe'
      // THEN: PostgreSQL UNIQUE constraint rejects insertion
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name LIKE '%username%'"
      )
      expect(uniqueConstraint.count).toBe(1)

      await expect(
        executeQuery("INSERT INTO users (username) VALUES ('john_doe')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const rowCount = await executeQuery('SELECT COUNT(*) as count FROM users')
      expect(rowCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-FIELD-SINGLE-LINE-TEXT-003: should reject NULL value when table has required single-line-text field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table 'tasks' with required single-line-text field 'title'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'title', type: 'single-line-text', required: true },
            ],
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required title
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='title'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO tasks (title) VALUES ('Complete project') RETURNING title"
      )
      expect(validInsert.title).toBe('Complete project')

      await expect(executeQuery('INSERT INTO tasks (title) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-SINGLE-LINE-TEXT-FIELD-004: should create btree index for fast text lookups when single-line-text field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with single-line-text field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'sku', type: 'single-line-text', unique: true, indexed: true },
            ],
          },
        ],
      })

      // WHEN: index is created on the text field
      // THEN: PostgreSQL btree index exists for fast text lookups
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_products_sku'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_products_sku',
        tablename: 'products',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_products_sku'"
      )
      expect(indexDef.indexdef).toContain('USING btree (sku)')
    }
  )

  test.fixme(
    'APP-SINGLE-LINE-TEXT-FIELD-005: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with single-line-text field 'name' and default value 'Untitled'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_documents',
            name: 'documents',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'name', type: 'single-line-text', default: 'Untitled' },
            ],
          },
        ],
      })

      // WHEN: row inserted without providing name value
      // THEN: PostgreSQL applies DEFAULT value 'Untitled'
      const defaultCheck = await executeQuery(
        "SELECT column_default FROM information_schema.columns WHERE table_name='documents' AND column_name='name'"
      )
      expect(defaultCheck.column_default).toBe("'Untitled'::character varying")

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

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full single-line-text-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative single-line-text field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'text_field',
                type: 'single-line-text',
                required: true,
                unique: true,
                indexed: true,
                default: 'Default Value',
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='text_field'"
      )
      expect(columnInfo.data_type).toBe('character varying')
      expect(columnInfo.character_maximum_length).toBe(255)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test unique constraint
      await executeQuery("INSERT INTO data (text_field) VALUES ('unique_value')")
      await expect(
        executeQuery("INSERT INTO data (text_field) VALUES ('unique_value')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )
})
