/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Color Field
 *
 * Source: src/domain/models/app/table/field-types/color-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Color Field Behavior:
 * - Stores hex color values (#RRGGBB format)
 * - VARCHAR(7) column with format validation
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Color Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-COLOR-001: should create VARCHAR(7) column for hex color storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'themes',
            fields: [{ id: 1, name: 'primary_color', type: 'color' }],
          },
        ],
      })
      // WHEN: querying the database
      const column = await executeQuery(
        "SELECT character_maximum_length FROM information_schema.columns WHERE table_name='themes' AND column_name='primary_color'"
      )
      // THEN: assertion
      expect(column.character_maximum_length).toBe(7)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-COLOR-002: should enforce hex color format via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'colors',
            fields: [{ id: 1, name: 'value', type: 'color' }],
          },
        ],
      })
      // WHEN: executing query
      await expect(executeQuery("INSERT INTO colors (value) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-COLOR-003: should store valid hex color values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'palettes',
            fields: [{ id: 1, name: 'color', type: 'color' }],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO palettes (color) VALUES ('#FF5733'), ('#3498DB')")
      // WHEN: querying the database
      const colors = await executeQuery('SELECT color FROM palettes ORDER BY id')
      // THEN: assertion
      expect(colors.rows).toEqual([{ color: '#FF5733' }, { color: '#3498DB' }])
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-COLOR-004: should support NULL for optional colors',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [{ id: 1, name: 'accent_color', type: 'color' }],
          },
        ],
      })
      // WHEN: executing query
      await executeQuery('INSERT INTO items (accent_color) VALUES (NULL)')
      // WHEN: querying the database
      const result = await executeQuery('SELECT accent_color FROM items WHERE id = 1')
      // THEN: assertion
      expect(result.accent_color).toBeNull()
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-COLOR-005: should require NOT NULL when color is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'brands',
            fields: [{ id: 1, name: 'brand_color', type: 'color', required: true }],
          },
        ],
      })
      // WHEN: executing query
      await expect(executeQuery('INSERT INTO brands (brand_color) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-COLOR-REGRESSION: user can complete full color-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await test.step('APP-TABLES-FIELD-TYPES-COLOR-001: Create VARCHAR(7) column for hex color storage', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 1,
              name: 'themes',
              fields: [{ id: 1, name: 'primary_color', type: 'color' }],
            },
          ],
        })
        const column = await executeQuery(
          "SELECT character_maximum_length FROM information_schema.columns WHERE table_name='themes' AND column_name='primary_color'"
        )
        expect(column.character_maximum_length).toBe(7)
      })

      await test.step('APP-TABLES-FIELD-TYPES-COLOR-002: Enforce hex color format via CHECK constraint', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 2,
              name: 'colors',
              fields: [{ id: 1, name: 'value', type: 'color' }],
            },
          ],
        })
        await expect(executeQuery("INSERT INTO colors (value) VALUES ('invalid')")).rejects.toThrow(
          /violates check constraint/
        )
      })

      await test.step('APP-TABLES-FIELD-TYPES-COLOR-003: Store valid hex color values', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 3,
              name: 'palettes',
              fields: [{ id: 1, name: 'color', type: 'color' }],
            },
          ],
        })
        await executeQuery("INSERT INTO palettes (color) VALUES ('#FF5733'), ('#3498DB')")
        const colors = await executeQuery('SELECT color FROM palettes ORDER BY id')
        expect(colors.rows).toEqual([{ color: '#FF5733' }, { color: '#3498DB' }])
      })

      await test.step('APP-TABLES-FIELD-TYPES-COLOR-004: Support NULL for optional colors', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 4,
              name: 'items',
              fields: [{ id: 1, name: 'accent_color', type: 'color' }],
            },
          ],
        })
        await executeQuery('INSERT INTO items (accent_color) VALUES (NULL)')
        const result = await executeQuery('SELECT accent_color FROM items WHERE id = 1')
        expect(result.accent_color).toBeNull()
      })

      await test.step('APP-TABLES-FIELD-TYPES-COLOR-005: Require NOT NULL when color is required', async () => {
        await startServerWithSchema({
          name: 'test-app',
          tables: [
            {
              id: 5,
              name: 'brands',
              fields: [{ id: 1, name: 'brand_color', type: 'color', required: true }],
            },
          ],
        })
        await expect(
          executeQuery('INSERT INTO brands (brand_color) VALUES (NULL)')
        ).rejects.toThrow(/violates not-null constraint/)
      })
    }
  )
})
