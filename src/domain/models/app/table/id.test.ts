/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema } from 'effect'
import { IdSchema } from './id'

describe('IdSchema', () => {
  describe('Valid IDs', () => {
    test('should accept ID of 1 (minimum value)', () => {
      // GIVEN: The minimum valid ID
      const id = 1

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted without modification
      expect(result).toBe(1)
    })

    test('should accept ID of 2', () => {
      // GIVEN: A small positive integer ID
      const id = 2

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(2)
    })

    test('should accept ID of 100', () => {
      // GIVEN: A medium-sized positive integer ID
      const id = 100

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(100)
    })

    test('should accept ID of 1000', () => {
      // GIVEN: A larger positive integer ID
      const id = 1000

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(1000)
    })

    test('should accept ID of 9007199254740991 (MAX_SAFE_INTEGER)', () => {
      // GIVEN: The maximum valid ID (JavaScript MAX_SAFE_INTEGER)
      const id = 9_007_199_254_740_991

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(9_007_199_254_740_991)
    })

    test('should accept ID of 999999999', () => {
      // GIVEN: A large positive integer ID
      const id = 999_999_999

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(999_999_999)
    })
  })

  describe('Invalid IDs - Zero and Negative', () => {
    test('should reject ID of 0', () => {
      // GIVEN: An ID of 0 (below minimum)
      const id = 0

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject negative IDs', () => {
      // GIVEN: A negative ID
      const id = -1

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject large negative IDs', () => {
      // GIVEN: A large negative ID
      const id = -1000

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })
  })

  describe('Invalid IDs - Too Large', () => {
    test('should reject ID greater than MAX_SAFE_INTEGER', () => {
      // GIVEN: An ID exceeding MAX_SAFE_INTEGER
      const id = 9_007_199_254_740_992

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject extremely large IDs', () => {
      // GIVEN: An ID well above MAX_SAFE_INTEGER
      const id = 10_000_000_000_000_000

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })
  })

  describe('Invalid IDs - Non-integer Types', () => {
    test('should reject decimal numbers', () => {
      // GIVEN: A decimal number
      const id = 1.5

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject floating point numbers', () => {
      // GIVEN: A floating point number
      const id = 3.141_59

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject string representations of numbers', () => {
      // GIVEN: A string containing a number
      const id = '123'

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const id = null

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // GIVEN: An undefined value
      const id = undefined

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject boolean values', () => {
      // GIVEN: A boolean value
      const id = true

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject objects', () => {
      // GIVEN: An object
      const id = { value: 1 }

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject arrays', () => {
      // GIVEN: An array
      const id = [1]

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })
  })

  describe('Invalid IDs - Special Number Values', () => {
    test('should reject NaN', () => {
      // GIVEN: NaN value
      const id = NaN

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject Infinity', () => {
      // GIVEN: Infinity value
      const id = Infinity

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should reject negative Infinity', () => {
      // GIVEN: Negative Infinity value
      const id = -Infinity

      // WHEN: The ID is validated against the schema
      // THEN: It should throw a validation error
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer Id type correctly', () => {
      // GIVEN: A valid ID
      const id = 42

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: TypeScript should infer the correct type (number)
      const typedResult: number = result
      expect(typedResult).toBe(42)
    })
  })

  describe('Boundary Testing', () => {
    test('should accept exactly minimum boundary (1)', () => {
      // GIVEN: The minimum boundary value
      const id = 1

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(1)
    })

    test('should reject just below minimum boundary (0)', () => {
      // GIVEN: A value just below the minimum boundary
      const id = 0

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should accept exactly maximum boundary (MAX_SAFE_INTEGER)', () => {
      // GIVEN: The maximum boundary value
      const id = 9_007_199_254_740_991

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(9_007_199_254_740_991)
    })

    test('should reject just above maximum boundary', () => {
      // GIVEN: A value just above the maximum boundary
      const id = 9_007_199_254_740_992

      // WHEN/THEN: The ID validation should fail
      expect(() => {
        Schema.decodeUnknownSync(IdSchema)(id)
      }).toThrow()
    })

    test('should accept value in middle of range', () => {
      // GIVEN: A value in the middle of the valid range
      const id = 5_000_000_000_000_000

      // WHEN: The ID is validated against the schema
      const result = Schema.decodeUnknownSync(IdSchema)(id)

      // THEN: The ID should be accepted
      expect(result).toBe(5_000_000_000_000_000)
    })
  })
})
