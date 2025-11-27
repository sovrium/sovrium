/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Array Field
 *
 * Source: specs/app/tables/field-types/array-field/array-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Array Field', () => {
  test(
    'APP-ARRAY-FIELD-001: should create PostgreSQL TEXT array column',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'articles',
            fields: [{ id: 1, name: 'tags', type: 'array', itemType: 'text' }],
          },
        ],
      })

      // WHEN: querying the database
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='articles' AND column_name='tags'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('tags')
      // THEN: assertion
      expect(columnInfo.data_type).toBe('ARRAY')

      // WHEN: querying the database
      const emptyArray = await executeQuery(
        'INSERT INTO articles (tags) VALUES (ARRAY[]::TEXT[]) RETURNING tags'
      )
      // THEN: assertion
      expect(emptyArray.tags).toEqual([])

      const multipleItems = await executeQuery(
        "INSERT INTO articles (tags) VALUES (ARRAY['javascript', 'react', 'typescript']) RETURNING tags"
      )
      // THEN: assertion
      expect(multipleItems.tags).toEqual(['javascript', 'react', 'typescript'])
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-002: should support array containment, overlap, and length',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'posts',
            fields: [{ id: 1, name: 'keywords', type: 'array', itemType: 'text' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO posts (keywords) VALUES (ARRAY['nodejs', 'express']), (ARRAY['nodejs', 'fastify']), (ARRAY['python', 'flask'])"
      )

      // WHEN: querying the database
      const containsValue = await executeQuery(
        "SELECT COUNT(*) as count FROM posts WHERE 'nodejs' = ANY(keywords)"
      )
      // THEN: assertion
      expect(containsValue.count).toBe(2)

      const arrayOverlap = await executeQuery(
        "SELECT COUNT(*) as count FROM posts WHERE keywords && ARRAY['nodejs', 'python']"
      )
      // THEN: assertion
      expect(arrayOverlap.count).toBe(3)

      const arrayLength = await executeQuery(
        'SELECT array_length(keywords, 1) as length FROM posts WHERE id = 1'
      )
      // THEN: assertion
      expect(arrayLength.length).toBe(2)
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-003: should enforce maximum array size via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'datasets',
            fields: [{ id: 1, name: 'numbers', type: 'array', itemType: 'integer', maxItems: 10 }],
          },
        ],
      })

      // WHEN: querying the database
      const maxItems = await executeQuery(
        'INSERT INTO datasets (numbers) VALUES (ARRAY[1,2,3,4,5,6,7,8,9,10]) RETURNING array_length(numbers, 1) as length'
      )
      // THEN: assertion
      expect(maxItems.length).toBe(10)

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO datasets (numbers) VALUES (ARRAY[1,2,3,4,5,6,7,8,9,10,11])')
      ).rejects.toThrow(/violates check constraint/)

      const emptyAllowed = await executeQuery(
        'INSERT INTO datasets (numbers) VALUES (ARRAY[]::INTEGER[]) RETURNING numbers'
      )
      // THEN: assertion
      expect(emptyAllowed.numbers).toEqual([])
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-004: should create GIN index for efficient array queries',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'documents',
            fields: [{ id: 1, name: 'categories', type: 'array', itemType: 'text', indexed: true }],
          },
        ],
      })

      // WHEN: querying the database
      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_documents_categories'"
      )
      // THEN: assertion
      expect(indexInfo.indexname).toBe('idx_documents_categories')
      // THEN: assertion
      expect(indexInfo.tablename).toBe('documents')

      // WHEN: querying the database
      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_documents_categories'"
      )
      // THEN: assertion
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_documents_categories ON public.documents USING gin (categories)'
      )
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-005: should support dynamic array manipulation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'recipes',
            fields: [{ id: 1, name: 'ingredients', type: 'array', itemType: 'text' }],
          },
        ],
      })

      // WHEN: querying the database
      await executeQuery(
        "INSERT INTO recipes (ingredients) VALUES (ARRAY['flour', 'sugar', 'eggs'])"
      )

      // WHEN: querying the database
      const arrayAppend = await executeQuery(
        "UPDATE recipes SET ingredients = array_append(ingredients, 'butter') WHERE id = 1 RETURNING ingredients"
      )
      // THEN: assertion
      expect(arrayAppend.ingredients).toEqual(['flour', 'sugar', 'eggs', 'butter'])

      const arrayRemove = await executeQuery(
        "UPDATE recipes SET ingredients = array_remove(ingredients, 'sugar') WHERE id = 1 RETURNING ingredients"
      )
      // THEN: assertion
      expect(arrayRemove.ingredients).toEqual(['flour', 'eggs', 'butter'])

      const arrayAccess = await executeQuery(
        'SELECT ingredients[1] as first_ingredient FROM recipes WHERE id = 1'
      )
      // THEN: assertion
      expect(arrayAccess.first_ingredient).toBe('flour')
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-006: user can complete full array-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'items', type: 'array', itemType: 'text' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: executing query
      await executeQuery("INSERT INTO data (items) VALUES (ARRAY['a', 'b', 'c'])")
      // WHEN: querying the database
      const stored = await executeQuery('SELECT items FROM data WHERE id = 1')
      // THEN: assertion
      expect(stored.items).toEqual(['a', 'b', 'c'])

      // WHEN: querying the database
      const containsCheck = await executeQuery(
        "SELECT COUNT(*) as count FROM data WHERE 'b' = ANY(items)"
      )
      // THEN: assertion
      expect(containsCheck.count).toBe(1)

      const lengthCheck = await executeQuery(
        'SELECT array_length(items, 1) as length FROM data WHERE id = 1'
      )
      // THEN: assertion
      expect(lengthCheck.length).toBe(3)
    }
  )
})
