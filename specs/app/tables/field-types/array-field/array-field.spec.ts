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
  test.fixme(
    'APP-ARRAY-FIELD-001: should create PostgreSQL TEXT array column',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery('CREATE TABLE articles (id SERIAL PRIMARY KEY, tags TEXT[])')

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='articles' AND column_name='tags'"
      )
      expect(columnInfo.column_name).toBe('tags')
      expect(columnInfo.data_type).toBe('ARRAY')

      const emptyArray = await executeQuery(
        'INSERT INTO articles (tags) VALUES (ARRAY[]::TEXT[]) RETURNING tags'
      )
      expect(emptyArray.tags).toEqual([])

      const multipleItems = await executeQuery(
        "INSERT INTO articles (tags) VALUES (ARRAY['javascript', 'react', 'typescript']) RETURNING tags"
      )
      expect(multipleItems.tags).toEqual(['javascript', 'react', 'typescript'])
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-002: should support array containment, overlap, and length',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE posts (id SERIAL PRIMARY KEY, keywords TEXT[])',
        "INSERT INTO posts (keywords) VALUES (ARRAY['nodejs', 'express']), (ARRAY['nodejs', 'fastify']), (ARRAY['python', 'flask'])",
      ])

      const containsValue = await executeQuery(
        "SELECT COUNT(*) as count FROM posts WHERE 'nodejs' = ANY(keywords)"
      )
      expect(containsValue.count).toBe(2)

      const arrayOverlap = await executeQuery(
        "SELECT COUNT(*) as count FROM posts WHERE keywords && ARRAY['nodejs', 'python']"
      )
      expect(arrayOverlap.count).toBe(3)

      const arrayLength = await executeQuery(
        'SELECT array_length(keywords, 1) as length FROM posts WHERE id = 1'
      )
      expect(arrayLength.length).toBe(2)
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-003: should enforce maximum array size via CHECK constraint',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery(
        'CREATE TABLE datasets (id SERIAL PRIMARY KEY, numbers INTEGER[] CHECK (array_length(numbers, 1) <= 10))'
      )

      const maxItems = await executeQuery(
        'INSERT INTO datasets (numbers) VALUES (ARRAY[1,2,3,4,5,6,7,8,9,10]) RETURNING array_length(numbers, 1) as length'
      )
      expect(maxItems.length).toBe(10)

      await expect(
        executeQuery('INSERT INTO datasets (numbers) VALUES (ARRAY[1,2,3,4,5,6,7,8,9,10,11])')
      ).rejects.toThrow(/violates check constraint/)

      const emptyAllowed = await executeQuery(
        'INSERT INTO datasets (numbers) VALUES (ARRAY[]::INTEGER[]) RETURNING numbers'
      )
      expect(emptyAllowed.numbers).toEqual([])
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-004: should create GIN index for efficient array queries',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE documents (id SERIAL PRIMARY KEY, categories TEXT[])',
        'CREATE INDEX idx_documents_categories ON documents USING GIN(categories)',
      ])

      const indexInfo = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_documents_categories'"
      )
      expect(indexInfo.indexname).toBe('idx_documents_categories')
      expect(indexInfo.tablename).toBe('documents')

      const indexDef = await executeQuery(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_documents_categories'"
      )
      expect(indexDef.indexdef).toBe(
        'CREATE INDEX idx_documents_categories ON public.documents USING gin (categories)'
      )
    }
  )

  test.fixme(
    'APP-ARRAY-FIELD-005: should support dynamic array manipulation',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await executeQuery([
        'CREATE TABLE recipes (id SERIAL PRIMARY KEY, ingredients TEXT[])',
        "INSERT INTO recipes (ingredients) VALUES (ARRAY['flour', 'sugar', 'eggs'])",
      ])

      const arrayAppend = await executeQuery(
        "UPDATE recipes SET ingredients = array_append(ingredients, 'butter') WHERE id = 1 RETURNING ingredients"
      )
      expect(arrayAppend.ingredients).toEqual(['flour', 'sugar', 'eggs', 'butter'])

      const arrayRemove = await executeQuery(
        "UPDATE recipes SET ingredients = array_remove(ingredients, 'sugar') WHERE id = 1 RETURNING ingredients"
      )
      expect(arrayRemove.ingredients).toEqual(['flour', 'eggs', 'butter'])

      const arrayAccess = await executeQuery(
        'SELECT ingredients[1] as first_ingredient FROM recipes WHERE id = 1'
      )
      expect(arrayAccess.first_ingredient).toBe('flour')
    }
  )

  test.fixme(
    'user can complete full array-field workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema, executeQuery: _executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'items', type: 'array', itemType: 'text' },
            ],
          },
        ],
      })

      await executeQuery("INSERT INTO data (items) VALUES (ARRAY['a', 'b', 'c'])")
      const stored = await executeQuery('SELECT items FROM data WHERE id = 1')
      expect(stored.items).toEqual(['a', 'b', 'c'])

      const containsCheck = await executeQuery(
        "SELECT COUNT(*) as count FROM data WHERE 'b' = ANY(items)"
      )
      expect(containsCheck.count).toBe(1)

      const lengthCheck = await executeQuery(
        'SELECT array_length(items, 1) as length FROM data WHERE id = 1'
      )
      expect(lengthCheck.length).toBe(3)
    }
  )
})
