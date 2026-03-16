/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { RollupFieldSchema } from './rollup-field'

describe('RollupFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid rollup field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'total',
        type: 'rollup' as const,
        relationshipField: 'orders',
        relatedField: 'amount',
        aggregation: 'SUM',

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }
      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with single filter condition', () => {
      // Given: A valid input with a single filter condition
      const field = {
        id: 1,
        name: 'completed_hours',
        type: 'rollup' as const,
        relationshipField: 'project_id',
        relatedField: 'hours',
        aggregation: 'sum',
        filters: { field: 'status', operator: 'equals', value: 'completed' },
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with AND filter group', () => {
      // Given: A valid input with AND filter group
      const field = {
        id: 1,
        name: 'priority_completed_hours',
        type: 'rollup' as const,
        relationshipField: 'project_id',
        relatedField: 'hours',
        aggregation: 'sum',
        filters: {
          and: [
            { field: 'status', operator: 'equals', value: 'completed' },
            { field: 'priority', operator: 'equals', value: 'high' },
          ],
        },
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with OR filter group', () => {
      // Given: A valid input with OR filter group
      const field = {
        id: 1,
        name: 'urgent_hours',
        type: 'rollup' as const,
        relationshipField: 'project_id',
        relatedField: 'hours',
        aggregation: 'sum',
        filters: {
          or: [
            { field: 'priority', operator: 'equals', value: 'high' },
            { field: 'priority', operator: 'equals', value: 'urgent' },
          ],
        },
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with nested filter groups', () => {
      // Given: A valid input with nested filter groups
      const field = {
        id: 1,
        name: 'complex_hours',
        type: 'rollup' as const,
        relationshipField: 'project_id',
        relatedField: 'hours',
        aggregation: 'sum',
        filters: {
          and: [
            { field: 'status', operator: 'equals', value: 'active' },
            {
              or: [
                { field: 'priority', operator: 'equals', value: 'high' },
                { field: 'priority', operator: 'equals', value: 'urgent' },
              ],
            },
          ],
        },
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with format', () => {
      // Given: A valid input with format
      const field = {
        id: 1,
        name: 'total_revenue',
        type: 'rollup' as const,
        relationshipField: 'invoices',
        relatedField: 'amount',
        aggregation: 'sum',
        format: 'currency',
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rollup field with all optional properties', () => {
      // Given: A valid input with all optional properties
      const field = {
        id: 1,
        name: 'completed_revenue',
        type: 'rollup' as const,
        relationshipField: 'invoices',
        relatedField: 'amount',
        aggregation: 'sum',
        format: 'currency',
        filters: { field: 'status', operator: 'equals', value: 'paid' },
      }

      const result = Schema.decodeSync(RollupFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without relationshipField', () => {
      // Given: An invalid input without relationshipField
      const field = {
        id: 1,
        name: 'total',
        type: 'rollup' as const,
        relatedField: 'amount',
        aggregation: 'sum',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: relationshipField
        Schema.decodeSync(RollupFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without aggregation', () => {
      // Given: An invalid input without aggregation
      const field = {
        id: 1,
        name: 'total',
        type: 'rollup' as const,
        relationshipField: 'orders',
        relatedField: 'amount',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: aggregation
        Schema.decodeSync(RollupFieldSchema)(field)
      }).toThrow()
    })
  })
})
