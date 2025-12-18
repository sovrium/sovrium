/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { validatePrimaryKey } from './table-primary-key-validation'

describe('validatePrimaryKey', () => {
  describe('When primary key is undefined or invalid type', () => {
    test('Then returns undefined for undefined primary key', () => {
      const result = validatePrimaryKey(undefined, new Set(['name', 'email']))
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for non-composite type', () => {
      const result = validatePrimaryKey({ type: 'auto' }, new Set(['name', 'email']))
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for composite without fields', () => {
      const result = validatePrimaryKey({ type: 'composite' }, new Set(['name', 'email']))
      expect(result).toBeUndefined()
    })
  })

  describe('When primary key is valid composite', () => {
    test('Then returns undefined for valid single field', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['email'] },
        new Set(['name', 'email'])
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for valid multiple fields', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['tenant_id', 'user_id'] },
        new Set(['tenant_id', 'user_id', 'name'])
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special field "id"', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['id'] },
        new Set(['name', 'email'])
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special field "created_at"', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['created_at', 'name'] },
        new Set(['name', 'email'])
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special field "updated_at"', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['updated_at'] },
        new Set(['name'])
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special field "deleted_at"', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['deleted_at'] },
        new Set(['name'])
      )
      expect(result).toBeUndefined()
    })
  })

  describe('When primary key has duplicate fields', () => {
    test('Then returns error with duplicate field name', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['email', 'email'] },
        new Set(['email', 'name'])
      )
      expect(result).toEqual({
        message:
          "Primary key field 'email' is not unique - duplicate field references in composite primary key",
        path: ['primaryKey', 'fields'],
      })
    })

    test('Then detects duplicate in longer list', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['a', 'b', 'c', 'b', 'd'] },
        new Set(['a', 'b', 'c', 'd'])
      )
      expect(result).toEqual({
        message:
          "Primary key field 'b' is not unique - duplicate field references in composite primary key",
        path: ['primaryKey', 'fields'],
      })
    })
  })

  describe('When primary key references non-existent field', () => {
    test('Then returns error for unknown field', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['unknown_field'] },
        new Set(['name', 'email'])
      )
      expect(result).toEqual({
        message:
          "Primary key references non-existent field 'unknown_field' - field not found in table",
        path: ['primaryKey', 'fields'],
      })
    })

    test('Then returns error for first unknown field in list', () => {
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['name', 'missing', 'also_missing'] },
        new Set(['name', 'email'])
      )
      expect(result).toEqual({
        message: "Primary key references non-existent field 'missing' - field not found in table",
        path: ['primaryKey', 'fields'],
      })
    })

    test('Then checks for non-existent after duplicate check', () => {
      // Duplicate check happens first, so if both errors exist, duplicate wins
      const result = validatePrimaryKey(
        { type: 'composite', fields: ['name', 'name', 'missing'] },
        new Set(['name', 'email'])
      )
      expect(result?.message).toContain('is not unique')
    })
  })
})
