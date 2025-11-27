/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Color Field', () => {
  test.fixme(
    'APP-TABLES-FIELD-TYPES-COLOR-001: should create VARCHAR(7) column for hex color storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 1, name: 'themes', fields: [{ id: 1, name: 'primary_color', type: 'color' }] },
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COLOR-002: should enforce hex color format via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 2, name: 'colors', fields: [{ id: 1, name: 'value', type: 'color' }] }],
      })
      // WHEN: executing query
      await expect(executeQuery("INSERT INTO colors (value) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COLOR-003: should store valid hex color values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 3, name: 'palettes', fields: [{ id: 1, name: 'color', type: 'color' }] }],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO palettes (color) VALUES ('#FF5733'), ('#3498DB')")
      // WHEN: querying the database
      const colors = await executeQuery('SELECT color FROM palettes ORDER BY id')
      // THEN: assertion
      expect(colors).toEqual([{ color: '#FF5733' }, { color: '#3498DB' }])
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COLOR-004: should support NULL for optional colors',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          { id: 4, name: 'items', fields: [{ id: 1, name: 'accent_color', type: 'color' }] },
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

  test.fixme(
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

  test.fixme(
    'APP-TABLES-FIELD-TYPES-COLOR-006: user can complete full color-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [{ id: 6, name: 'data', fields: [{ id: 1, name: 'color', type: 'color' }] }],
      })
      // WHEN: executing query
      await executeQuery("INSERT INTO data (color) VALUES ('#ABCDEF')")
      // WHEN: querying the database
      const result = await executeQuery('SELECT color FROM data WHERE id = 1')
      // THEN: assertion
      expect(result.color).toBe('#ABCDEF')
    }
  )
})
