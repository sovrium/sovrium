/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewIdSchema } from './id'

describe('ViewIdSchema', () => {
  describe('Valid IDs', () => {
    test('should accept numeric ID', () => {
      // GIVEN: A numeric view ID
      const id = 1

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(1)
    })

    test('should accept string ID', () => {
      // GIVEN: A string view ID
      const id = 'default-view'

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe('default-view')
    })

    test('should accept large numeric ID', () => {
      // GIVEN: A large numeric ID
      const id = 999_999

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(999_999)
    })

    test('should accept zero as ID', () => {
      // GIVEN: Zero as ID
      const id = 0

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(0)
    })
  })

  describe('Invalid IDs', () => {
    test('should reject empty string as ID (pattern validation)', () => {
      // GIVEN: An empty string ID
      const id = ''

      // WHEN/THEN: The ID validation should fail due to pattern mismatch
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject uppercase and spaces in string ID', () => {
      // GIVEN: A string ID with uppercase and spaces
      const id = 'Invalid View ID'

      // WHEN/THEN: The ID validation should fail due to pattern mismatch
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const id = null

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // GIVEN: An undefined value
      const id = undefined

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject object', () => {
      // GIVEN: An object
      const id = { value: 1 }

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject array', () => {
      // GIVEN: An array
      const id = [1]

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })

    test('should reject boolean', () => {
      // GIVEN: A boolean
      const id = true

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewIdSchema)(id)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewId type correctly for number', () => {
      // GIVEN: A numeric ID
      const id = 42

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: TypeScript should infer the correct type
      expect(typeof result).toBe('number')
    })

    test('should infer ViewId type correctly for string', () => {
      // GIVEN: A string ID
      const id = 'test-view'

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(ViewIdSchema)(id)

      // THEN: TypeScript should infer the correct type
      expect(typeof result).toBe('string')
    })
  })
})
