/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Checkbox Field
 *
 * Source: src/domain/models/app/table/field-types/checkbox-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Checkbox Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-001: should create PostgreSQL BOOLEAN column when table configuration has checkbox field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with checkbox field 'is_active'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'is_active', type: 'checkbox' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL BOOLEAN column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='is_active'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('is_active')
      expect(columnInfo.data_type).toBe('boolean')
      expect(columnInfo.is_nullable).toBe('YES')

      const trueInsert = await executeQuery(
        'INSERT INTO users (is_active) VALUES (TRUE) RETURNING is_active'
      )
      // THEN: assertion
      expect(trueInsert.is_active).toBe(true)

      const falseInsert = await executeQuery(
        'INSERT INTO users (is_active) VALUES (FALSE) RETURNING is_active'
      )
      // THEN: assertion
      expect(falseInsert.is_active).toBe(false)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-002: should store true/false values correctly when checkbox is checked or unchecked',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with checkbox field 'completed'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'completed', type: 'checkbox' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: checkbox is checked or unchecked
      // THEN: true/false values are stored correctly
      await executeQuery(['INSERT INTO tasks (completed) VALUES (TRUE), (FALSE), (NULL)'])

      const results = await executeQuery('SELECT id, completed FROM tasks ORDER BY id')
      // THEN: assertion
      expect(results.rows).toEqual([
        { id: 1, completed: true },
        { id: 2, completed: false },
        { id: 3, completed: null },
      ])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-003: should reject NULL value when checkbox field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with required checkbox field 'terms_accepted'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'registrations',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'terms_accepted', type: 'checkbox', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: attempting to insert NULL for required checkbox
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='registrations' AND column_name='terms_accepted'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        'INSERT INTO registrations (terms_accepted) VALUES (TRUE) RETURNING terms_accepted'
      )
      // THEN: assertion
      expect(validInsert.terms_accepted).toBe(true)

      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO registrations (terms_accepted) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with checkbox field 'enabled' and default value FALSE
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'features',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'enabled', type: 'checkbox', default: false },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing enabled value
      // THEN: PostgreSQL applies DEFAULT value FALSE
      const defaultInsert = await executeQuery(
        'INSERT INTO features (id) VALUES (DEFAULT) RETURNING enabled'
      )
      // THEN: assertion
      expect(defaultInsert.enabled).toBe(false)

      const explicitInsert = await executeQuery(
        'INSERT INTO features (enabled) VALUES (TRUE) RETURNING enabled'
      )
      // THEN: assertion
      expect(explicitInsert.enabled).toBe(true)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-005: should create btree index for fast queries when checkbox field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with checkbox field 'published', indexed=true
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
                name: 'published',
                type: 'checkbox',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the checkbox field
      // THEN: PostgreSQL btree index exists for fast boolean queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_posts_published'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_posts_published')
      expect(indexExists.tablename).toBe('posts')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-CHECKBOX-REGRESSION: user can complete full checkbox-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with checkbox fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'is_active', type: 'checkbox' },
              { id: 3, name: 'terms_accepted', type: 'checkbox', required: true },
              { id: 4, name: 'enabled', type: 'checkbox', default: false },
              { id: 5, name: 'published', type: 'checkbox', required: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-CHECKBOX-001: Creates PostgreSQL BOOLEAN column', async () => {
        // WHEN: querying column info for checkbox field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='is_active'"
        )
        // THEN: PostgreSQL BOOLEAN column is created
        expect(columnInfo.column_name).toBe('is_active')
        expect(columnInfo.data_type).toBe('boolean')
        expect(columnInfo.is_nullable).toBe('YES')
      })

      await test.step('APP-TABLES-FIELD-TYPES-CHECKBOX-002: Stores true/false values correctly', async () => {
        // WHEN: inserting true and false values
        const trueInsert = await executeQuery(
          'INSERT INTO data (is_active, terms_accepted, published) VALUES (TRUE, TRUE, TRUE) RETURNING is_active'
        )
        // THEN: true value is stored
        expect(trueInsert.is_active).toBe(true)

        const falseInsert = await executeQuery(
          'INSERT INTO data (is_active, terms_accepted, published) VALUES (FALSE, TRUE, FALSE) RETURNING is_active'
        )
        // THEN: false value is stored
        expect(falseInsert.is_active).toBe(false)

        // WHEN: inserting NULL for optional checkbox
        const nullInsert = await executeQuery(
          'INSERT INTO data (is_active, terms_accepted, published) VALUES (NULL, TRUE, TRUE) RETURNING is_active'
        )
        // THEN: NULL is stored for optional checkbox
        expect(nullInsert.is_active).toBe(null)
      })

      await test.step('APP-TABLES-FIELD-TYPES-CHECKBOX-003: Rejects NULL value when required', async () => {
        // WHEN: querying NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='terms_accepted'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: attempting to insert NULL for required checkbox
        // THEN: NOT NULL constraint rejects insertion
        await expect(
          executeQuery(
            'INSERT INTO data (is_active, terms_accepted, published) VALUES (TRUE, NULL, TRUE)'
          )
        ).rejects.toThrow(/violates not-null constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-CHECKBOX-004: Applies DEFAULT value', async () => {
        // WHEN: inserting row without providing enabled value
        const defaultInsert = await executeQuery(
          'INSERT INTO data (terms_accepted, published) VALUES (TRUE, TRUE) RETURNING enabled'
        )
        // THEN: DEFAULT value FALSE is applied
        expect(defaultInsert.enabled).toBe(false)

        // WHEN: explicitly providing value
        const explicitInsert = await executeQuery(
          'INSERT INTO data (terms_accepted, published, enabled) VALUES (TRUE, TRUE, TRUE) RETURNING enabled'
        )
        // THEN: explicit value overrides default
        expect(explicitInsert.enabled).toBe(true)
      })

      await test.step('APP-TABLES-FIELD-TYPES-CHECKBOX-005: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed checkbox field
        const indexExists = await executeQuery(
          "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_data_published'"
        )
        // THEN: btree index exists for fast queries
        expect(indexExists.indexname).toBe('idx_data_published')
        expect(indexExists.tablename).toBe('data')
      })
    }
  )
})
