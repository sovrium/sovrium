/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { validateIndexes } from './table-indexes-validation'

describe('validateIndexes', () => {
  test('should return undefined when all index fields exist', () => {
    const indexes = [
      { name: 'idx_email', fields: ['email'] },
      { name: 'idx_name_status', fields: ['name', 'status'] },
    ]
    const fieldNames = new Set(['id', 'email', 'name', 'status'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toBeUndefined()
  })

  test('should return error when index references non-existent field', () => {
    const indexes = [
      { name: 'idx_email', fields: ['email'] },
      { name: 'idx_missing', fields: ['non_existent_field'] },
    ]
    const fieldNames = new Set(['id', 'email', 'name'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toEqual({
      message: 'Index "idx_missing" references non-existent column "non_existent_field"',
      path: ['indexes'],
    })
  })

  test('should return error for first non-existent field when multiple indexes are invalid', () => {
    const indexes = [
      { name: 'idx_valid', fields: ['email'] },
      { name: 'idx_invalid1', fields: ['missing1'] },
      { name: 'idx_invalid2', fields: ['missing2'] },
    ]
    const fieldNames = new Set(['id', 'email'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toEqual({
      message: 'Index "idx_invalid1" references non-existent column "missing1"',
      path: ['indexes'],
    })
  })

  test('should return error when composite index has one invalid field', () => {
    const indexes = [{ name: 'idx_composite', fields: ['email', 'status', 'invalid_field'] }]
    const fieldNames = new Set(['id', 'email', 'status'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toEqual({
      message: 'Index "idx_composite" references non-existent column "invalid_field"',
      path: ['indexes'],
    })
  })

  test('should handle empty indexes array', () => {
    const indexes: ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<string> }> =
      []
    const fieldNames = new Set(['id', 'email'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toBeUndefined()
  })

  test('should handle single field index', () => {
    const indexes = [{ name: 'idx_email', fields: ['email'] }]
    const fieldNames = new Set(['id', 'email', 'name'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toBeUndefined()
  })

  test('should validate multiple valid indexes', () => {
    const indexes = [
      { name: 'idx_email', fields: ['email'] },
      { name: 'idx_status', fields: ['status'] },
      { name: 'idx_composite', fields: ['email', 'status'] },
    ]
    const fieldNames = new Set(['id', 'email', 'name', 'status'])

    const result = validateIndexes(indexes, fieldNames)

    expect(result).toBeUndefined()
  })
})
