/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for URL Field
 *
 * Source: specs/app/tables/field-types/url-field/url-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('URL Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test.fixme(
    'APP-FIELD-URL-001: should create PostgreSQL VARCHAR(255) column for URL storage when table configuration has url field',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: table configuration with url field 'website'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_companies',
            name: 'companies',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'website', type: 'url' },
            ],
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL VARCHAR(255) column is created for URL storage
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='companies' AND column_name='website'"
      )
      expect(columnInfo).toEqual({
        column_name: 'website',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'YES',
      })

      const validInsert = await executeQuery(
        "INSERT INTO companies (website) VALUES ('https://example.com') RETURNING website"
      )
      expect(validInsert.website).toBe('https://example.com')
    }
  )

  test.fixme(
    'APP-FIELD-URL-002: should store both protocols correctly when inserting URLs with different protocols',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: table 'products' with url field 'product_url'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'product_url', type: 'url' },
            ],
          },
        ],
      })

      // WHEN: insert URLs with different protocols (http, https)
      // THEN: both protocols are stored correctly in VARCHAR column
      const httpsInsert = await executeQuery(
        "INSERT INTO products (product_url) VALUES ('https://secure.example.com/product/123') RETURNING product_url"
      )
      expect(httpsInsert.product_url).toBe('https://secure.example.com/product/123')

      const httpInsert = await executeQuery(
        "INSERT INTO products (product_url) VALUES ('http://legacy.example.com/item') RETURNING product_url"
      )
      expect(httpInsert.product_url).toBe('http://legacy.example.com/item')

      const bothStored = await executeQuery(
        "SELECT COUNT(*) as count FROM products WHERE product_url LIKE 'http%://%'"
      )
      expect(bothStored.count).toBe(2)
    }
  )

  test.fixme(
    'APP-FIELD-URL-003: should reject duplicate URL when table has url field with unique constraint',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: table 'links' with url field 'url' (required, unique), existing row url='https://example.com'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_links',
            name: 'links',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'url', type: 'url', unique: true, required: true },
            ],
          },
        ],
      })

      await executeQuery(["INSERT INTO links (url) VALUES ('https://example.com')"])

      // WHEN: attempt to insert duplicate url='https://example.com'
      // THEN: PostgreSQL UNIQUE constraint rejects insertion
      const uniqueConstraint = await executeQuery(
        "SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_name='links' AND constraint_type='UNIQUE' AND constraint_name LIKE '%url%'"
      )
      expect(uniqueConstraint.count).toBe(1)

      await expect(
        executeQuery("INSERT INTO links (url) VALUES ('https://example.com')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)

      const rowCount = await executeQuery('SELECT COUNT(*) as count FROM links')
      expect(rowCount.count).toBe(1)
    }
  )

  test.fixme(
    'APP-URL-FIELD-004: should reject NULL value when table has required url field',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: table 'resources' with required url field 'resource_url'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_resources',
            name: 'resources',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'resource_url', type: 'url', required: true },
            ],
          },
        ],
      })

      // WHEN: attempt to insert NULL value for required resource_url
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='resources' AND column_name='resource_url'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        "INSERT INTO resources (resource_url) VALUES ('https://cdn.example.com/file.pdf') RETURNING resource_url"
      )
      expect(validInsert.resource_url).toBe('https://cdn.example.com/file.pdf')

      await expect(
        executeQuery('INSERT INTO resources (resource_url) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test.fixme(
    'APP-URL-FIELD-005: should create btree index for fast URL lookups when url field has indexed=true',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: table configuration with url field, indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_bookmarks',
            name: 'bookmarks',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'url', type: 'url', unique: true, indexed: true },
            ],
          },
        ],
      })

      // WHEN: index is created on the url field
      // THEN: PostgreSQL btree index exists for fast URL lookups
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_bookmarks_url'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_bookmarks_url',
        tablename: 'bookmarks',
      })

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_bookmarks_url'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_bookmarks_url ON public.bookmarks USING btree (url)'
      )
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'user can complete full url-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      // GIVEN: Application configured with representative url field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'url_field',
                type: 'url',
                required: true,
                unique: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='url_field'"
      )
      expect(columnInfo.data_type).toBe('character varying')
      expect(columnInfo.character_maximum_length).toBe(255)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test URL insertion and uniqueness
      await executeQuery("INSERT INTO data (url_field) VALUES ('https://test.com/path')")
      await expect(
        executeQuery("INSERT INTO data (url_field) VALUES ('https://test.com/path')")
      ).rejects.toThrow(/duplicate key value violates unique constraint/)
    }
  )
})
