/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewSortSchema } from './sorts'

describe('ViewSortSchema', () => {
  describe('Valid Sorts', () => {
    test('should accept ascending sort', () => {
      // GIVEN: An ascending sort configuration
      const sort = { field: 'name', direction: 'asc' }

      // WHEN: The sort is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSortSchema)(sort)

      // THEN: The sort should be accepted
      expect(result).toEqual({ field: 'name', direction: 'asc' })
    })

    test('should accept descending sort', () => {
      // GIVEN: A descending sort configuration
      const sort = { field: 'createdAt', direction: 'desc' }

      // WHEN: The sort is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSortSchema)(sort)

      // THEN: The sort should be accepted
      expect(result).toEqual({ field: 'createdAt', direction: 'desc' })
    })

    test('should accept sort with complex field name', () => {
      // GIVEN: A sort with complex field name
      const sort = { field: 'user_profile_updated_at', direction: 'desc' as const }

      // WHEN: The sort is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSortSchema)(sort)

      // THEN: The sort should be accepted
      expect(result).toEqual(sort)
    })
  })

  describe('Invalid Sorts', () => {
    test('should reject missing field', () => {
      // GIVEN: A sort without field
      const sort = { direction: 'asc' }

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject invalid direction', () => {
      // GIVEN: A sort with invalid direction
      const sort = { field: 'name', direction: 'ascending' }

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject missing direction', () => {
      // GIVEN: A sort without direction
      const sort = { field: 'name' }

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject uppercase direction', () => {
      // GIVEN: A sort with uppercase direction
      const sort = { field: 'name', direction: 'ASC' }

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const sort = null

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject empty object', () => {
      // GIVEN: An empty object
      const sort = {}

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })

    test('should reject numeric field', () => {
      // GIVEN: A sort with numeric field
      const sort = { field: 123, direction: 'asc' }

      // WHEN/THEN: The sort validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewSortSchema)(sort)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewSort type correctly', () => {
      // GIVEN: A valid sort
      const sort = { field: 'name', direction: 'asc' as const }

      // WHEN: The sort is validated against the schema
      const result = Schema.decodeUnknownSync(ViewSortSchema)(sort)

      // THEN: TypeScript should infer the correct type
      expect(result.field).toBe('name')
      expect(result.direction).toBe('asc')
    })
  })
})
