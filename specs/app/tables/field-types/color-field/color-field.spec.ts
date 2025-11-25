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
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery('CREATE TABLE themes (id SERIAL PRIMARY KEY, primary_color VARCHAR(7))')
      const column = await executeQuery(
        "SELECT character_maximum_length FROM information_schema.columns WHERE table_name='themes' AND column_name='primary_color'"
      )
      expect(column.character_maximum_length).toBe(7)
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-002: should enforce hex color format via CHECK constraint',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery(
        "CREATE TABLE colors (id SERIAL PRIMARY KEY, value VARCHAR(7) CHECK (value ~ '^#[0-9A-Fa-f]{6}$'))"
      )
      await expect(executeQuery("INSERT INTO colors (value) VALUES ('invalid')")).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-003: should store valid hex color values',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE palettes (id SERIAL PRIMARY KEY, color VARCHAR(7))',
        "INSERT INTO palettes (color) VALUES ('#FF5733'), ('#3498DB')",
      ])
      const colors = await executeQuery('SELECT color FROM palettes ORDER BY id')
      expect(colors).toEqual([{ color: '#FF5733' }, { color: '#3498DB' }])
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-004: should support NULL for optional colors',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE items (id SERIAL PRIMARY KEY, accent_color VARCHAR(7))',
        'INSERT INTO items (accent_color) VALUES (NULL)',
      ])
      const result = await executeQuery('SELECT accent_color FROM items WHERE id = 1')
      expect(result.accent_color).toBeNull()
    }
  )

  test.fixme(
    'APP-COLOR-FIELD-005: should require NOT NULL when color is required',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery(
        'CREATE TABLE brands (id SERIAL PRIMARY KEY, brand_color VARCHAR(7) NOT NULL)'
      )
      await expect(executeQuery('INSERT INTO brands (brand_color) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'user can complete full color-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await executeQuery([
        'CREATE TABLE data (id SERIAL PRIMARY KEY, color VARCHAR(7))',
        "INSERT INTO data (color) VALUES ('#ABCDEF')",
      ])
      const result = await executeQuery('SELECT color FROM data WHERE id = 1')
      expect(result.color).toBe('#ABCDEF')
    }
  )
})
