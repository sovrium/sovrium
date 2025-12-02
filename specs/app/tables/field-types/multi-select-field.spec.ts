/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Multi Select Field
 *
 * Source: src/domain/models/app/table/field-types/multi-select-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Multi Select Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-001: should create PostgreSQL TEXT ARRAY column for multi select storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'tags',
                type: 'multi-select',
                options: ['new', 'sale', 'featured', 'limited'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='tags'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/ARRAY|array/)
      // THEN: assertion
      expect(columnInfo.is_nullable).toBe('YES')

      // WHEN: executing query
      const validInsert = await executeQuery(
        "INSERT INTO products (tags) VALUES (ARRAY['new', 'sale']) RETURNING tags"
      )
      // THEN: assertion
      expect(validInsert.tags).toContain('new')
      // THEN: assertion
      expect(validInsert.tags).toContain('sale')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-002: should allow storing multiple values from predefined options',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'articles',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'categories',
                type: 'multi-select',
                options: ['tech', 'business', 'health', 'sports'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery([
        "INSERT INTO articles (categories) VALUES (ARRAY['tech', 'business']), (ARRAY['health']), (ARRAY['tech', 'sports', 'business'])",
      ])

      // WHEN: executing query
      const results = await executeQuery('SELECT categories FROM articles ORDER BY id')
      // THEN: assertion
      expect(results.rows.length).toBe(3)
      // THEN: assertion
      expect(results.rows[0].categories.length).toBe(2)
      // THEN: assertion
      expect(results.rows[2].categories.length).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-003: should reject NULL value when multi-select field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'skills',
                type: 'multi-select',
                options: ['python', 'javascript', 'rust'],
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='projects' AND column_name='skills'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // WHEN: executing query
      await expect(executeQuery('INSERT INTO projects (skills) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'roles',
                type: 'multi-select',
                options: ['user', 'admin', 'moderator'],
                default: ['user'],
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const defaultInsert = await executeQuery(
        'INSERT INTO users (id) VALUES (DEFAULT) RETURNING roles'
      )
      // THEN: assertion
      expect(defaultInsert.roles).toContain('user')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-005: should create GIN index for fast array queries when multi-select field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'posts',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'tags',
                type: 'multi-select',
                options: ['tag1', 'tag2', 'tag3'],
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_posts_tags'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_posts_tags')
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-006: user can complete full multi-select-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('Setup: Start server with multi-select field', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 6,
              name: 'data',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'multiselect_field',
                  type: 'multi-select',
                  options: ['opt1', 'opt2', 'opt3', 'opt4'],
                  required: true,
                  indexed: true,
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      })

      await test.step('Insert and verify multi-select values', async () => {
        await executeQuery("INSERT INTO data (multiselect_field) VALUES (ARRAY['opt1', 'opt3'])")
        const stored = await executeQuery('SELECT multiselect_field FROM data WHERE id = 1')
        expect(stored.multiselect_field).toContain('opt1')
        expect(stored.multiselect_field).toContain('opt3')
      })

      await test.step('Query using array contains operator', async () => {
        const matching = await executeQuery(
          "SELECT COUNT(*) as count FROM data WHERE multiselect_field @> ARRAY['opt1']"
        )
        expect(matching.count).toBe(1)
      })
    }
  )
})
