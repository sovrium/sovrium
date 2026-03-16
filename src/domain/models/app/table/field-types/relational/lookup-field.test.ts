/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { LookupFieldSchema } from './lookup-field'

describe('LookupFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid lookup field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'email',
        type: 'lookup' as const,
        relationshipField: 'customer',
        relatedField: 'email',

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }
      const result = Schema.decodeSync(LookupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept lookup field with single filter condition', () => {
      // Given: A valid input with a single filter condition
      const field = {
        id: 1,
        name: 'active_tasks',
        type: 'lookup' as const,
        relationshipField: 'project_id',
        relatedField: 'title',
        filters: { field: 'status', operator: 'equals', value: 'active' },
      }

      const result = Schema.decodeSync(LookupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept lookup field with AND filter group', () => {
      // Given: A valid input with AND filter group
      const field = {
        id: 1,
        name: 'priority_tasks',
        type: 'lookup' as const,
        relationshipField: 'project_id',
        relatedField: 'title',
        filters: {
          and: [
            { field: 'status', operator: 'equals', value: 'active' },
            { field: 'priority', operator: 'equals', value: 'high' },
          ],
        },
      }

      const result = Schema.decodeSync(LookupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept lookup field with OR filter group', () => {
      // Given: A valid input with OR filter group
      const field = {
        id: 1,
        name: 'urgent_tasks',
        type: 'lookup' as const,
        relationshipField: 'project_id',
        relatedField: 'title',
        filters: {
          or: [
            { field: 'priority', operator: 'equals', value: 'high' },
            { field: 'priority', operator: 'equals', value: 'urgent' },
          ],
        },
      }

      const result = Schema.decodeSync(LookupFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept lookup field with nested filter groups', () => {
      // Given: A valid input with nested filter groups
      const field = {
        id: 1,
        name: 'complex_tasks',
        type: 'lookup' as const,
        relationshipField: 'project_id',
        relatedField: 'title',
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

      const result = Schema.decodeSync(LookupFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without relationshipField', () => {
      // Given: An invalid input without relationshipField
      const field = {
        id: 1,
        name: 'email',
        type: 'lookup' as const,
        relatedField: 'email',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: relationshipField
        Schema.decodeSync(LookupFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without relatedField', () => {
      // Given: An invalid input without relatedField
      const field = {
        id: 1,
        name: 'email',
        type: 'lookup' as const,
        relationshipField: 'customer',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: relatedField
        Schema.decodeSync(LookupFieldSchema)(field)
      }).toThrow()
    })
  })
})
