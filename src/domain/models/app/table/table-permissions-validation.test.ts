/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { validateFieldPermissions, validateTablePermissions } from './table-permissions-validation'

describe('validateFieldPermissions', () => {
  const fieldNames = new Set(['name', 'email', 'status'])

  describe('When field permissions have duplicates', () => {
    test('Then returns error for duplicate field', () => {
      const result = validateFieldPermissions([{ field: 'name' }, { field: 'name' }], fieldNames)
      expect(result).toEqual({
        message: "Duplicate field permission for field 'name' - conflicting permission definitions",
        path: ['permissions', 'fields'],
      })
    })
  })

  describe('When field permissions reference non-existent field', () => {
    test('Then returns error for unknown field', () => {
      const result = validateFieldPermissions([{ field: 'missing' }], fieldNames)
      expect(result).toEqual({
        message:
          "Field permission references non-existent field 'missing' - field does not exist in table",
        path: ['permissions', 'fields'],
      })
    })
  })

  describe('When field permissions are valid', () => {
    test('Then returns undefined for existing fields', () => {
      const result = validateFieldPermissions([{ field: 'name' }, { field: 'email' }], fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for empty array', () => {
      const result = validateFieldPermissions([], fieldNames)
      expect(result).toBeUndefined()
    })
  })
})

describe('validateTablePermissions', () => {
  const fields = [
    { name: 'name', type: 'single-line-text' },
    { name: 'user_id', type: 'user' },
  ]
  const fieldNames = new Set(['name', 'user_id'])

  test('returns undefined for valid permissions', () => {
    const result = validateTablePermissions({}, fields, fieldNames)
    expect(result).toBeUndefined()
  })

  test('validates field permissions', () => {
    const result = validateTablePermissions({ fields: [{ field: 'missing' }] }, fields, fieldNames)
    expect(result?.message).toContain('does not exist in table')
  })

  test('returns undefined when no field permissions', () => {
    const result = validateTablePermissions({}, fields, fieldNames)
    expect(result).toBeUndefined()
  })
})
