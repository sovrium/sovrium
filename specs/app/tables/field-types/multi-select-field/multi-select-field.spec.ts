/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Multi Select Field
 *
 * Source: specs/app/tables/field-types/multi-select-field/multi-select-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Multi Select Field', () => {
  test.fixme(
    'APP-MULTI-SELECT-FIELD-001: should create PostgreSQL TEXT ARRAY column for multi select storage',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'tags',
                type: 'multi-select',
                options: ['new', 'sale', 'featured', 'limited'],
              },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='tags'"
      )
      expect(columnInfo.data_type).toMatch(/ARRAY|array/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        "INSERT INTO products (tags) VALUES (ARRAY['new', 'sale']) RETURNING tags"
      )
      expect(validInsert.tags).toContain('new')
      expect(validInsert.tags).toContain('sale')
    }
  )

  test.fixme(
    'APP-MULTI-SELECT-FIELD-002: should allow storing multiple values from predefined options',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_articles',
            name: 'articles',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'categories',
                type: 'multi-select',
                options: ['tech', 'business', 'health', 'sports'],
              },
            ],
          },
        ],
      })

      await executeQuery([
        "INSERT INTO articles (categories) VALUES (ARRAY['tech', 'business']), (ARRAY['health']), (ARRAY['tech', 'sports', 'business'])",
      ])

      const results = await executeQuery('SELECT categories FROM articles ORDER BY id')
      expect(results.length).toBe(3)
      expect(results[0].categories.length).toBe(2)
      expect(results[2].categories.length).toBe(3)
    }
  )

  test.fixme(
    'APP-MULTI-SELECT-FIELD-003: should reject NULL value when multi-select field is required',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_projects',
            name: 'projects',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'skills',
                type: 'multi-select',
                options: ['python', 'javascript', 'rust'],
                required: true,
              },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='projects' AND column_name='skills'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      await expect(executeQuery('INSERT INTO projects (skills) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-MULTI-SELECT-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'roles',
                type: 'multi-select',
                options: ['user', 'admin', 'moderator'],
                default: ['user'],
              },
            ],
          },
        ],
      })

      const defaultInsert = await executeQuery(
        'INSERT INTO users (id) VALUES (DEFAULT) RETURNING roles'
      )
      expect(defaultInsert.roles).toContain('user')
    }
  )

  test.fixme(
    'APP-MULTI-SELECT-FIELD-005: should create GIN index for fast array queries when multi-select field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_posts',
            name: 'posts',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'tags',
                type: 'multi-select',
                options: ['tag1', 'tag2', 'tag3'],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_posts_tags'"
      )
      expect(indexExists.indexname).toBe('idx_posts_tags')
    }
  )

  test.fixme(
    'user can complete full multi-select-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'multiselect_field',
                type: 'multi-select',
                options: ['opt1', 'opt2', 'opt3', 'opt4'],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (multiselect_field) VALUES (ARRAY['opt1', 'opt3'])")
      const stored = await executeQuery('SELECT multiselect_field FROM data WHERE id = 1')
      expect(stored.multiselect_field).toContain('opt1')
      expect(stored.multiselect_field).toContain('opt3')

      // Query using array contains operator
      const matching = await executeQuery(
        "SELECT COUNT(*) as count FROM data WHERE multiselect_field @> ARRAY['opt1']"
      )
      expect(matching.count).toBe(1)
    }
  )
})
