/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * E2E Tests for Checkbox Field
 *
 * Source: specs/app/tables/field-types/checkbox-field/checkbox-field.schema.json
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

  test.fixme(
    'APP-CHECKBOX-FIELD-001: should create PostgreSQL BOOLEAN column when table configuration has checkbox field',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with checkbox field 'is_active'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_users',
            name: 'users',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'is_active', type: 'checkbox' },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL BOOLEAN column is created
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='is_active'"
      )
      expect(columnInfo).toEqual({
        column_name: 'is_active',
        data_type: 'boolean',
        is_nullable: 'YES',
      })

      const trueInsert = await executeQuery(
        'INSERT INTO users (is_active) VALUES (TRUE) RETURNING is_active'
      )
      expect(trueInsert.is_active).toBe(true)

      const falseInsert = await executeQuery(
        'INSERT INTO users (is_active) VALUES (FALSE) RETURNING is_active'
      )
      expect(falseInsert.is_active).toBe(false)
    }
  )

  test.fixme(
    'APP-CHECKBOX-FIELD-002: should store true/false values correctly when checkbox is checked or unchecked',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with checkbox field 'completed'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_tasks',
            name: 'tasks',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'completed', type: 'checkbox' },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: checkbox is checked or unchecked
      // THEN: true/false values are stored correctly
      await executeQuery(['INSERT INTO tasks (completed) VALUES (TRUE), (FALSE), (NULL)'])

      const results = await executeQuery('SELECT id, completed FROM tasks ORDER BY id')
      expect(results).toEqual([
        { id: 1, completed: true },
        { id: 2, completed: false },
        { id: 3, completed: null },
      ])
    }
  )

  test.fixme(
    'APP-CHECKBOX-FIELD-003: should reject NULL value when checkbox field is required',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with required checkbox field 'terms_accepted'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_registrations',
            name: 'registrations',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'terms_accepted', type: 'checkbox', required: true },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: attempting to insert NULL for required checkbox
      // THEN: PostgreSQL NOT NULL constraint rejects insertion
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='registrations' AND column_name='terms_accepted'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      const validInsert = await executeQuery(
        'INSERT INTO registrations (terms_accepted) VALUES (TRUE) RETURNING terms_accepted'
      )
      expect(validInsert.terms_accepted).toBe(true)

      await expect(
        executeQuery('INSERT INTO registrations (terms_accepted) VALUES (NULL)')
      ).rejects.toThrow(/violates not-null constraint/)
    }
  )

  test.fixme(
    'APP-CHECKBOX-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table with checkbox field 'enabled' and default value FALSE
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_features',
            name: 'features',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'enabled', type: 'checkbox', default: false },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: row inserted without providing enabled value
      // THEN: PostgreSQL applies DEFAULT value FALSE
      const defaultInsert = await executeQuery(
        'INSERT INTO features (id) VALUES (DEFAULT) RETURNING enabled'
      )
      expect(defaultInsert.enabled).toBe(false)

      const explicitInsert = await executeQuery(
        'INSERT INTO features (enabled) VALUES (TRUE) RETURNING enabled'
      )
      expect(explicitInsert.enabled).toBe(true)
    }
  )

  test.fixme(
    'APP-CHECKBOX-FIELD-005: should create btree index for fast queries when checkbox field has indexed=true',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with checkbox field 'published', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_posts',
            name: 'posts',
            fields: [
              { name: 'id', type: 'integer', required: true },
              { name: 'published', type: 'checkbox', required: true, indexed: true },
            ],
            primaryKey: {
              fields: ['id'],
            },
          },
        ],
      })

      // WHEN: index is created on the checkbox field
      // THEN: PostgreSQL btree index exists for fast boolean queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_posts_published'"
      )
      expect(indexExists).toEqual({
        indexname: 'idx_posts_published',
        tablename: 'posts',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-CHECKBOX-REGRESSION-001: user can complete full checkbox-field workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative checkbox field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', required: true },
              {
                name: 'checkbox_field',
                type: 'checkbox',
                required: true,
                indexed: true,
                default: false,
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
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='checkbox_field'"
      )
      expect(columnInfo.data_type).toBe('boolean')
      expect(columnInfo.is_nullable).toBe('NO')

      // Test boolean values
      await executeQuery('INSERT INTO data (checkbox_field) VALUES (TRUE)')
      const stored = await executeQuery('SELECT checkbox_field FROM data WHERE id = 1')
      expect(stored.checkbox_field).toBe(true)

      // Test filtering by boolean
      await executeQuery('INSERT INTO data (checkbox_field) VALUES (FALSE)')
      const filtered = await executeQuery(
        'SELECT COUNT(*) as count FROM data WHERE checkbox_field = TRUE'
      )
      expect(filtered.count).toBe(1)
    }
  )
})
