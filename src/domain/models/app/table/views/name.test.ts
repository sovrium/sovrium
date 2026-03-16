/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewNameSchema } from './name'

describe('ViewNameSchema', () => {
  describe('Valid Names', () => {
    test('should accept simple name', () => {
      // GIVEN: A simple view name
      const name = 'All Records'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe('All Records')
    })

    test('should accept single character name', () => {
      // GIVEN: A single character name
      const name = 'A'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe('A')
    })

    test('should accept name at maximum length', () => {
      // GIVEN: A name at maximum length (100 characters)
      const name = 'A'.repeat(100)

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe(name)
    })

    test('should accept name with special characters', () => {
      // GIVEN: A name with special characters
      const name = 'Active Tasks - 2024 (Q1)'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe(name)
    })

    test('should accept name with unicode characters', () => {
      // GIVEN: A name with unicode characters
      const name = 'Tâches actives'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe(name)
    })
  })

  describe('Invalid Names', () => {
    test('should reject empty string', () => {
      // GIVEN: An empty string
      const name = ''

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })

    test('should reject name exceeding maximum length', () => {
      // GIVEN: A name exceeding 100 characters
      const name = 'A'.repeat(101)

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })

    test('should reject non-string types', () => {
      // GIVEN: A number
      const name = 123

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const name = null

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // GIVEN: An undefined value
      const name = undefined

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })

    test('should reject object', () => {
      // GIVEN: An object
      const name = { value: 'test' }

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })
  })

  describe('Boundary Testing', () => {
    test('should accept exactly minimum length (1)', () => {
      // GIVEN: A name at minimum length
      const name = 'X'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe('X')
    })

    test('should accept exactly maximum length (100)', () => {
      // GIVEN: A name at maximum length
      const name = 'B'.repeat(100)

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(ViewNameSchema)(name)

      // THEN: The name should be accepted
      expect(result).toBe(name)
    })

    test('should reject just above maximum length (101)', () => {
      // GIVEN: A name just above maximum length
      const name = 'C'.repeat(101)

      // WHEN/THEN: The name validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewNameSchema)(name)
      }).toThrow()
    })
  })
})
