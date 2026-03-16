/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewGroupBySchema } from './group-by'

describe('ViewGroupBySchema', () => {
  describe('Valid Group By', () => {
    test('should accept minimal group by', () => {
      // GIVEN: A minimal group by configuration
      const groupBy = { field: 'status' }

      // WHEN: The groupBy is validated against the schema
      const result = Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)

      // THEN: The groupBy should be accepted
      expect(result).toEqual({ field: 'status' })
    })

    test('should accept group by with ascending order', () => {
      // GIVEN: A group by with ascending order
      const groupBy = { field: 'category', direction: 'asc' }

      // WHEN: The groupBy is validated against the schema
      const result = Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)

      // THEN: The groupBy should be accepted
      expect(result).toEqual({ field: 'category', direction: 'asc' })
    })

    test('should accept group by with descending order', () => {
      // GIVEN: A group by with descending order
      const groupBy = { field: 'priority', direction: 'desc' }

      // WHEN: The groupBy is validated against the schema
      const result = Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)

      // THEN: The groupBy should be accepted
      expect(result).toEqual({ field: 'priority', direction: 'desc' })
    })

    test('should accept group by with complex field name', () => {
      // GIVEN: A group by with complex field name
      const groupBy = { field: 'user_assigned_department', direction: 'asc' as const }

      // WHEN: The groupBy is validated against the schema
      const result = Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)

      // THEN: The groupBy should be accepted
      expect(result).toEqual(groupBy)
    })
  })

  describe('Invalid Group By', () => {
    test('should reject missing field', () => {
      // GIVEN: A group by without field
      const groupBy = { direction: 'asc' }

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })

    test('should reject invalid order', () => {
      // GIVEN: A group by with invalid order
      const groupBy = { field: 'status', direction: 'ascending' }

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })

    test('should reject uppercase order', () => {
      // GIVEN: A group by with uppercase order
      const groupBy = { field: 'status', direction: 'ASC' }

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const groupBy = null

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })

    test('should reject empty object', () => {
      // GIVEN: An empty object
      const groupBy = {}

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })

    test('should reject non-string field', () => {
      // GIVEN: A group by with non-string field
      const groupBy = { field: 123, direction: 'asc' }

      // WHEN/THEN: The groupBy validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewGroupBy type correctly', () => {
      // GIVEN: A valid group by
      const groupBy = { field: 'status', direction: 'desc' as const }

      // WHEN: The groupBy is validated against the schema
      const result = Schema.decodeUnknownSync(ViewGroupBySchema)(groupBy)

      // THEN: TypeScript should infer the correct type
      expect(result.field).toBe('status')
      expect(result.direction).toBe('desc')
    })
  })
})
