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

describe('ViewFiltersSchema (simplified and/or format)', () => {
  describe('Single Condition', () => {
    test('should accept a single condition as root filter', () => {
      // GIVEN: A single condition
      const filters = { field: 'status', operator: 'equals', value: 'active' }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The condition should be accepted
      expect(result).toEqual(filters)
    })
  })

  describe('AND Groups', () => {
    test('should accept AND group with single condition', () => {
      // GIVEN: AND group with one condition
      const filters = {
        and: [{ field: 'status', operator: 'equals', value: 'active' }],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept AND group with multiple conditions', () => {
      // GIVEN: AND group with multiple conditions
      const filters = {
        and: [
          { field: 'status', operator: 'equals', value: 'active' },
          { field: 'archived', operator: 'equals', value: false },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept empty AND group', () => {
      // GIVEN: Empty AND group
      const filters = { and: [] }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })
  })

  describe('OR Groups', () => {
    test('should accept OR group with multiple conditions', () => {
      // GIVEN: OR group with multiple conditions
      const filters = {
        or: [
          { field: 'status', operator: 'equals', value: 'pending' },
          { field: 'status', operator: 'equals', value: 'in-progress' },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept empty OR group', () => {
      // GIVEN: Empty OR group
      const filters = { or: [] }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The filters should be accepted
      expect(result).toEqual(filters)
    })
  })

  describe('Nested Groups (Prisma/MongoDB style)', () => {
    test('should accept nested OR inside AND', () => {
      // GIVEN: (status = 'active') AND ((priority = 'high') OR (priority = 'urgent'))
      const filters = {
        and: [
          { field: 'status', operator: 'equals', value: 'active' },
          {
            or: [
              { field: 'priority', operator: 'equals', value: 'high' },
              { field: 'priority', operator: 'equals', value: 'urgent' },
            ],
          },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The nested filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept nested AND inside OR', () => {
      // GIVEN: ((type = 'task') AND (status = 'completed')) OR ((type = 'bug') AND (severity = 'critical'))
      const filters = {
        or: [
          {
            and: [
              { field: 'type', operator: 'equals', value: 'task' },
              { field: 'status', operator: 'equals', value: 'completed' },
            ],
          },
          {
            and: [
              { field: 'type', operator: 'equals', value: 'bug' },
              { field: 'severity', operator: 'equals', value: 'critical' },
            ],
          },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The nested filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept mixed conditions and nested groups', () => {
      // GIVEN: Mixed flat conditions and nested groups
      const filters = {
        and: [
          { field: 'archived', operator: 'equals', value: false },
          { field: 'status', operator: 'notEquals', value: 'deleted' },
          {
            or: [
              { field: 'assignee', operator: 'equals', value: 'user123' },
              { field: 'created_by', operator: 'equals', value: 'user123' },
            ],
          },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The mixed filters should be accepted
      expect(result).toEqual(filters)
    })

    test('should accept three levels of nesting', () => {
      // GIVEN: Three levels of nested filter groups
      const filters = {
        and: [
          {
            or: [
              {
                and: [
                  { field: 'a', operator: 'equals', value: 1 },
                  { field: 'b', operator: 'equals', value: 2 },
                ],
              },
              { field: 'c', operator: 'equals', value: 3 },
            ],
          },
        ],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: The three-level nested filters should be accepted
      expect(result).toEqual(filters)
    })
  })

  describe('Invalid Filters', () => {
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

    test('should reject plain array', () => {
      // GIVEN: An array (should use { and: [...] } or { or: [...] })
      const filters = [{ field: 'status', operator: 'equals', value: 'active' }]

      // WHEN/THEN: The filters validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFiltersSchema)(filters)
      }).toThrow()
    })

    test('should pick first matching key when both and/or are present', () => {
      // GIVEN: Object with both and and or keys (ambiguous input)
      const filters = {
        and: [{ field: 'a', operator: 'equals', value: 1 }],
        or: [{ field: 'b', operator: 'equals', value: 2 }],
      }

      // WHEN: The filters are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFiltersSchema)(filters)

      // THEN: Schema picks `and` (first union variant) and drops `or`
      expect(result).toEqual({
        and: [{ field: 'a', operator: 'equals', value: 1 }],
      })
    })
  })
})
