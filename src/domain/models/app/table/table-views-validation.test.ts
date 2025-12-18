/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { validateViews } from './table-views-validation'

const v = (views: unknown[]): any => views

describe('validateViews', () => {
  const baseFields = [
    { name: 'name', type: 'single-line-text' },
    { name: 'email', type: 'email' },
    { name: 'status', type: 'single-select' },
    { name: 'active', type: 'checkbox' },
  ]
  const fieldNames = new Set(['name', 'email', 'status', 'active'])

  describe('When validating view IDs', () => {
    test('Then returns undefined for unique view IDs', () => {
      const result = validateViews(
        v([{ id: 'view-1' }, { id: 'view-2' }, { id: 'view-3' }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for numeric view IDs', () => {
      const result = validateViews(v([{ id: 1 }, { id: 2 }, { id: 3 }]), baseFields, fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then returns error for duplicate string IDs', () => {
      const result = validateViews(
        v([{ id: 'view-1' }, { id: 'view-2' }, { id: 'view-1' }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message: "Duplicate view id 'view-1' - view id must be unique within the table",
        path: ['views'],
      })
    })

    test('Then returns error for duplicate numeric IDs', () => {
      const result = validateViews(v([{ id: 1 }, { id: 2 }, { id: 1 }]), baseFields, fieldNames)
      expect(result).toEqual({
        message: "Duplicate view id '1' - view id must be unique within the table",
        path: ['views'],
      })
    })

    test('Then treats numeric and string IDs as equivalent', () => {
      const result = validateViews(v([{ id: 1 }, { id: '1' }]), baseFields, fieldNames)
      expect(result).toEqual({
        message: "Duplicate view id '1' - view id must be unique within the table",
        path: ['views'],
      })
    })
  })

  describe('When validating default views', () => {
    test('Then returns undefined for no default views', () => {
      const result = validateViews(v([{ id: 'view-1' }, { id: 'view-2' }]), baseFields, fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for single default view', () => {
      const result = validateViews(
        v([
          { id: 'view-1', isDefault: true },
          { id: 'view-2', isDefault: false },
        ]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for multiple default views', () => {
      const result = validateViews(
        v([
          { id: 'view-1', isDefault: true },
          { id: 'view-2', isDefault: true },
        ]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message: 'Only one default view is allowed per table - multiple default views found',
        path: ['views'],
      })
    })
  })

  describe('When validating view fields', () => {
    test('Then returns undefined for valid field references', () => {
      const result = validateViews(
        v([{ id: 'view-1', fields: ['name', 'email'] }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for empty fields array', () => {
      const result = validateViews(v([{ id: 'view-1', fields: [] }]), baseFields, fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then allows special field references', () => {
      const result = validateViews(
        v([{ id: 'view-1', fields: ['id', 'name', 'created_at', 'updated_at'] }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for non-existent field', () => {
      const result = validateViews(
        v([{ id: 'view-1', fields: ['name', 'missing_field'] }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message:
          "View field 'missing_field' not found - view fields must reference existing table fields (non-existent field in view)",
        path: ['views'],
      })
    })
  })

  describe('When validating view filters', () => {
    test('Then returns undefined for valid single filter', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'name', operator: 'equals', value: 'John' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for valid AND filter', () => {
      const result = validateViews(
        v([
          {
            id: 'view-1',
            filters: {
              and: [
                { field: 'name', operator: 'equals', value: 'John' },
                { field: 'email', operator: 'contains', value: '@example.com' },
              ],
            },
          },
        ]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for valid OR filter', () => {
      const result = validateViews(
        v([
          {
            id: 'view-1',
            filters: {
              or: [
                { field: 'status', operator: 'equals', value: 'active' },
                { field: 'status', operator: 'equals', value: 'pending' },
              ],
            },
          },
        ]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special fields in filters', () => {
      const result = validateViews(
        v([
          {
            id: 'view-1',
            filters: { field: 'created_at', operator: 'greaterThan', value: '2024-01-01' },
          },
        ]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for non-existent field in filter', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'unknown', operator: 'equals', value: 'test' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message: "Filter references non-existent field 'unknown' - field not found in table",
        path: ['views'],
      })
    })
  })

  describe('When validating view sorts', () => {
    test('Then returns undefined for valid sort', () => {
      const result = validateViews(
        v([{ id: 'view-1', sorts: [{ field: 'name', direction: 'asc' }] }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns undefined for empty sorts array', () => {
      const result = validateViews(v([{ id: 'view-1', sorts: [] }]), baseFields, fieldNames)
      expect(result).toBeUndefined()
    })

    test('Then allows special fields in sorts', () => {
      const result = validateViews(
        v([{ id: 'view-1', sorts: [{ field: 'created_at', direction: 'desc' }] }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for non-existent field in sort', () => {
      const result = validateViews(
        v([{ id: 'view-1', sorts: [{ field: 'unknown_field', direction: 'asc' }] }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message: "Sort references non-existent field 'unknown_field' - field not found in table",
        path: ['views'],
      })
    })
  })

  describe('When validating view groupBy', () => {
    test('Then returns undefined for valid groupBy', () => {
      const result = validateViews(
        v([{ id: 'view-1', groupBy: { field: 'status' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows special fields in groupBy', () => {
      const result = validateViews(
        v([{ id: 'view-1', groupBy: { field: 'created_at' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for non-existent field in groupBy', () => {
      const result = validateViews(
        v([{ id: 'view-1', groupBy: { field: 'unknown' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message: "groupBy references non-existent field 'unknown' - field not found in table",
        path: ['views'],
      })
    })
  })

  describe('When validating filter operator compatibility', () => {
    test('Then returns undefined for valid checkbox operators', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'active', operator: 'equals', value: true } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then allows isTrue operator for checkbox', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'active', operator: 'isTrue', value: null } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })

    test('Then returns error for contains operator on checkbox', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'active', operator: 'contains', value: 'true' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toEqual({
        message:
          "Incompatible operator 'contains' for field 'active' with type 'checkbox' - operator is invalid for checkbox field type",
        path: ['views'],
      })
    })

    test('Then allows any operator for non-restricted field types', () => {
      const result = validateViews(
        v([{ id: 'view-1', filters: { field: 'name', operator: 'contains', value: 'test' } }]),
        baseFields,
        fieldNames
      )
      expect(result).toBeUndefined()
    })
  })

  describe('When views array is empty', () => {
    test('Then returns undefined for empty views', () => {
      const result = validateViews(v([]), baseFields, fieldNames)
      expect(result).toBeUndefined()
    })
  })
})
