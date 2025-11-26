/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewFiltersSchema, ViewFilterConditionSchema } from './filters'

describe('ViewFilterConditionSchema', () => {
  describe('Valid Conditions', () => {
    test('should accept condition with string value', () => {
      // GIVEN: A condition with string value
      const condition = { field: 'status', operator: 'equals', value: 'active' }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted
      expect(result).toEqual(condition)
    })

    test('should accept condition with number value', () => {
      // GIVEN: A condition with number value
      const condition = { field: 'age', operator: 'greaterThan', value: 18 }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted
      expect(result).toEqual(condition)
    })

    test('should accept condition with boolean value', () => {
      // GIVEN: A condition with boolean value
      const condition = { field: 'archived', operator: 'equals', value: false }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted
      expect(result).toEqual(condition)
    })

    test('should accept condition with null value', () => {
      // GIVEN: A condition with null value
      const condition = { field: 'deletedAt', operator: 'isNull', value: null }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted
      expect(result).toEqual(condition)
    })

    test('should accept condition with array value', () => {
      // GIVEN: A condition with array value
      const condition = { field: 'tags', operator: 'contains', value: ['urgent', 'important'] }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted
      expect(result).toEqual(condition)
    })
  })

  describe('Invalid Conditions', () => {
    test('should reject condition without field', () => {
      // GIVEN: A condition without field
      const condition = { operator: 'equals', value: 'active' }

      // WHEN/THEN: The condition validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)
      }).toThrow()
    })

    test('should reject condition without operator', () => {
      // GIVEN: A condition without operator
      const condition = { field: 'status', value: 'active' }

      // WHEN/THEN: The condition validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)
      }).toThrow()
    })

    test('should accept condition without explicit value (undefined)', () => {
      // GIVEN: A condition without explicit value (Unknown accepts undefined)
      const condition = { field: 'status', operator: 'equals' }

      // WHEN: The condition is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFilterConditionSchema)(condition)

      // THEN: The condition should be accepted with undefined value
      expect(result).toEqual({ field: 'status', operator: 'equals', value: undefined })
    })
  })
})

describe('ViewFiltersSchema', () => {
  describe('Valid Filters', () => {
    test('should accept empty filters object', () => {
      // GIVEN: An empty filters object
      const filters = {}

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual({})
    })

    test('should accept filters with AND conjunction', () => {
      // GIVEN: Filters with AND conjunction
      const filters = {
        conjunction: 'and' as const,
        conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept filters with OR conjunction', () => {
      // GIVEN: Filters with OR conjunction
      const filters = {
        conjunction: 'or' as const,
        conditions: [
          { field: 'status', operator: 'equals', value: 'pending' },
          { field: 'status', operator: 'equals', value: 'in-progress' },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept filters with only conjunction', () => {
      // GIVEN: Filters with only conjunction
      const filters = { conjunction: 'and' as const }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept filters with only conditions', () => {
      // GIVEN: Filters with only conditions
      const filters = {
        conditions: [{ field: 'active', operator: 'equals', value: true }],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept filters with empty conditions array', () => {
      // GIVEN: Filters with empty conditions array
      const filters = { conjunction: 'and' as const, conditions: [] }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept filters with multiple conditions', () => {
      // GIVEN: Filters with multiple conditions
      const filters = {
        conjunction: 'and' as const,
        conditions: [
          { field: 'status', operator: 'equals', value: 'active' },
          { field: 'archived', operator: 'equals', value: false },
          { field: 'priority', operator: 'greaterThan', value: 3 },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })
  })

  describe('Invalid Filters', () => {
    test('should reject invalid conjunction', () => {
      // GIVEN: Filters with invalid conjunction
      const filters = { conjunction: 'xor' }

      // WHEN/THEN: The filters validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFiltersSchema)(filters)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const filters = null

      // WHEN/THEN: The filters validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFiltersSchema)(filters)
      }).toThrow()
    })

    test('should reject string', () => {
      // GIVEN: A string
      const filters = 'and'

      // WHEN/THEN: The filters validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFiltersSchema)(filters)
      }).toThrow()
    })

    test('should reject array', () => {
      // GIVEN: An array
      const filters = [{ field: 'status', operator: 'equals', value: 'active' }]

      // WHEN/THEN: The filters validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFiltersSchema)(filters)
      }).toThrow()
    })
  })
})
