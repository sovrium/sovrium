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
 * Spec Count: 8
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
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-006: should reject multi-select with empty options array',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Multi-select field with empty options array
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
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
                  options: [], // Empty options!
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/options.*empty|at least one option.*required/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-007: should reject multi-select with duplicate option values',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Multi-select field with duplicate option values
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'articles',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'categories',
                  type: 'multi-select',
                  options: ['tech', 'health', 'tech'], // Duplicate 'tech'!
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/duplicate.*option|options.*unique/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-008: should reject multi-select when maxSelections exceeds options length',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: Multi-select field with maxSelections > options.length
      // WHEN: Attempting to start server with invalid schema
      // THEN: Should throw validation error
      await expect(
        startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'items',
              fields: [
                { id: 1, name: 'id', type: 'integer', required: true },
                {
                  id: 2,
                  name: 'tags',
                  type: 'multi-select',
                  options: ['tag1', 'tag2'], // Only 2 options
                  maxSelections: 5, // Can't select 5 when only 2 exist!
                },
              ],
              primaryKey: { type: 'composite', fields: ['id'] },
            },
          ],
        })
      ).rejects.toThrow(/maxSelections.*exceeds.*options|maxSelections.*too large/i)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-MULTI-SELECT-REGRESSION: user can complete full multi-select-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with multi-select fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              {
                id: 1,
                name: 'tags',
                type: 'multi-select',
                options: ['new', 'sale', 'featured', 'limited'],
              },
              {
                id: 2,
                name: 'categories',
                type: 'multi-select',
                options: ['tech', 'business', 'health', 'sports'],
              },
              {
                id: 3,
                name: 'skills',
                type: 'multi-select',
                options: ['python', 'javascript', 'rust'],
                required: true,
              },
              {
                id: 4,
                name: 'roles',
                type: 'multi-select',
                options: ['user', 'admin', 'moderator'],
                default: ['user'],
              },
              {
                id: 5,
                name: 'indexed_tags',
                type: 'multi-select',
                options: ['tag1', 'tag2', 'tag3'],
                required: true,
                indexed: true,
              },
            ],
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-001: Creates PostgreSQL TEXT ARRAY column', async () => {
        // WHEN: querying column info for multi-select field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='tags'"
        )
        // THEN: TEXT ARRAY column is created and is nullable
        expect(columnInfo.data_type).toMatch(/ARRAY|array/)
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting multiple values
        const validInsert = await executeQuery(
          "INSERT INTO data (tags, skills, indexed_tags) VALUES (ARRAY['new', 'sale'], ARRAY['python'], ARRAY['tag1']) RETURNING tags"
        )
        // THEN: array values are stored correctly
        expect(validInsert.tags).toContain('new')
        expect(validInsert.tags).toContain('sale')
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-002: Stores multiple values from predefined options', async () => {
        // WHEN: inserting rows with varying numbers of selected options
        await executeQuery([
          "INSERT INTO data (categories, skills, indexed_tags) VALUES (ARRAY['tech', 'business'], ARRAY['python'], ARRAY['tag1']), (ARRAY['health'], ARRAY['javascript'], ARRAY['tag2']), (ARRAY['tech', 'sports', 'business'], ARRAY['rust'], ARRAY['tag3'])",
        ])
        // WHEN: querying the inserted rows
        const results = await executeQuery(
          'SELECT categories FROM data WHERE categories IS NOT NULL ORDER BY id'
        )
        // THEN: multiple values are stored per row
        expect(results.rows.length).toBe(3)
        expect(results.rows[0].categories.length).toBe(2)
        expect(results.rows[2].categories.length).toBe(3)
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-003: Rejects NULL when required', async () => {
        // WHEN: checking NOT NULL constraint on required field
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='skills'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: attempting to insert NULL into required field
        // THEN: constraint violation error is thrown
        await expect(
          executeQuery(
            "INSERT INTO data (tags, skills, indexed_tags) VALUES (ARRAY['new'], NULL, ARRAY['tag1'])"
          )
        ).rejects.toThrow(/violates not-null constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-004: Applies DEFAULT value', async () => {
        // WHEN: inserting row without providing optional field with default
        const defaultInsert = await executeQuery(
          "INSERT INTO data (skills, indexed_tags) VALUES (ARRAY['python'], ARRAY['tag1']) RETURNING roles"
        )
        // THEN: default value is applied
        expect(defaultInsert.roles).toContain('user')
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-005: Creates GIN index when indexed=true', async () => {
        // WHEN: checking for GIN index on indexed multi-select field
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_data_indexed_tags'"
        )
        // THEN: GIN index exists
        expect(indexExists.indexname).toBe('idx_data_indexed_tags')
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-006: Rejects empty options array', async () => {
        // WHEN: attempting to create multi-select with empty options
        // THEN: validation error is thrown
        await expect(
          startServerWithSchema({
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
                    options: [],
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/options.*empty|at least one option.*required/i)
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-007: Rejects duplicate option values', async () => {
        // WHEN: attempting to create multi-select with duplicate options
        // THEN: validation error is thrown
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'articles',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  {
                    id: 2,
                    name: 'categories',
                    type: 'multi-select',
                    options: ['tech', 'health', 'tech'],
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/duplicate.*option|options.*unique/i)
      })

      await test.step('APP-TABLES-FIELD-TYPES-MULTI-SELECT-008: Rejects maxSelections exceeding options length', async () => {
        // WHEN: attempting to create multi-select with maxSelections > options.length
        // THEN: validation error is thrown
        await expect(
          startServerWithSchema({
            name: 'test-app',
            tables: [
              {
                id: 1,
                name: 'items',
                fields: [
                  { id: 1, name: 'id', type: 'integer', required: true },
                  {
                    id: 2,
                    name: 'tags',
                    type: 'multi-select',
                    options: ['tag1', 'tag2'],
                    maxSelections: 5,
                  },
                ],
                primaryKey: { type: 'composite', fields: ['id'] },
              },
            ],
          })
        ).rejects.toThrow(/maxSelections.*exceeds.*options|maxSelections.*too large/i)
      })
    }
  )
})
