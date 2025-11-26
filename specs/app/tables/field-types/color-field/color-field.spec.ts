/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Color Field', () => {
  test.fixme(
    'APP-COLOR-FIELD-001: should create VARCHAR(7) column for hex color storage',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_themes',
            name: 'themes',
            fields: [{ name: 'primary_color', type: 'color' }],
          },
        ],
      })
      const column = await executeQuery(
        "SELECT character_maximum_length FROM information_schema.columns WHERE table_name='themes' AND column_name='primary_color'"
      )
      expect(column.character_maximum_length).toBe(7)
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-002: should enforce hex color format via CHECK constraint',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_colors',
            name: 'colors',
            fields: [{ name: 'value', type: 'color' }],
          },
        ],
      })
      await expect(executeQuery("INSERT INTO colors (value) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-003: should store valid hex color values',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_palettes',
            name: 'palettes',
            fields: [{ name: 'color', type: 'color' }],
          },
        ],
      })
      await executeQuery("INSERT INTO palettes (color) VALUES ('#FF5733'), ('#3498DB')")
      const colors = await executeQuery('SELECT color FROM palettes ORDER BY id')
      expect(colors).toEqual([{ color: '#FF5733' }, { color: '#3498DB' }])
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-004: should support NULL for optional colors',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [{ name: 'accent_color', type: 'color' }],
          },
        ],
      })
      await executeQuery('INSERT INTO items (accent_color) VALUES (NULL)')
      const result = await executeQuery('SELECT accent_color FROM items WHERE id = 1')
      expect(result.accent_color).toBeNull()
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-005: should require NOT NULL when color is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_brands',
            name: 'brands',
            fields: [{ name: 'brand_color', type: 'color', required: true }],
          },
        ],
      })
      await expect(executeQuery('INSERT INTO brands (brand_color) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-COLOR-REGRESSION-001: user can complete full color-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [{ name: 'color', type: 'color' }],
          },
        ],
      })
      await executeQuery("INSERT INTO data (color) VALUES ('#ABCDEF')")
      const result = await executeQuery('SELECT color FROM data WHERE id = 1')
      expect(result.color).toBe('#ABCDEF')
    }
  )
})
