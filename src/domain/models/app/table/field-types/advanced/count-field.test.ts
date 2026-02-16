/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { CountFieldSchema } from './count-field'

describe('CountFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid count field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'task_count',
        type: 'count' as const,
        relationshipField: 'tasks',

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }
      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept count field with single condition', () => {
      // Given: A valid input with a single condition
      const field = {
        id: 1,
        name: 'completed_task_count',
        type: 'count' as const,
        relationshipField: 'tasks',
        conditions: [{ field: 'status', operator: 'equals', value: 'completed' }],
      }

      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept count field with multiple conditions', () => {
      // Given: A valid input with multiple conditions
      const field = {
        id: 1,
        name: 'high_priority_completed_count',
        type: 'count' as const,
        relationshipField: 'tasks',
        conditions: [
          { field: 'status', operator: 'equals', value: 'completed' },
          { field: 'priority', operator: 'equals', value: 'high' },
        ],
      }

      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept count field with boolean condition value', () => {
      // Given: A valid input with boolean condition value
      const field = {
        id: 1,
        name: 'active_employee_count',
        type: 'count' as const,
        relationshipField: 'employees',
        conditions: [{ field: 'is_active', operator: 'equals', value: true }],
      }

      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept count field with numeric condition value', () => {
      // Given: A valid input with numeric condition value
      const field = {
        id: 1,
        name: 'senior_employee_count',
        type: 'count' as const,
        relationshipField: 'employees',
        conditions: [{ field: 'years_experience', operator: 'greaterThan', value: 5 }],
      }

      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept count field with empty conditions array', () => {
      // Given: A valid input with empty conditions array
      const field = {
        id: 1,
        name: 'total_count',
        type: 'count' as const,
        relationshipField: 'items',
        conditions: [],
      }

      const result = Schema.decodeSync(CountFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without relationshipField', () => {
      // Given: An invalid input without relationshipField
      const field = {
        id: 1,
        name: 'task_count',
        type: 'count' as const,
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: relationshipField
        Schema.decodeSync(CountFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with empty relationshipField', () => {
      // Given: An invalid input with empty relationshipField
      const field = {
        id: 1,
        name: 'task_count',
        type: 'count' as const,
        relationshipField: '',
      }

      expect(() => {
        Schema.decodeSync(CountFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with wrong type', () => {
      // Given: An invalid input with wrong type
      const field = {
        id: 1,
        name: 'task_count',
        type: 'rollup' as const,
        relationshipField: 'tasks',
      }

      expect(() => {
        // @ts-expect-error - Testing wrong type
        Schema.decodeSync(CountFieldSchema)(field)
      }).toThrow()
    })
  })
})
