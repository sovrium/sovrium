/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { NameSchema } from './name'

describe('NameSchema', () => {
  describe('valid values', () => {
    test('should accept simple lowercase names', () => {
      // Given: Simple lowercase table names (non-reserved keywords)
      const validNames = ['person', 'product', 'invoice', 'customer']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(NameSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with underscores', () => {
      // Given: Table names with underscores (snake_case)
      const validNames = ['person_profile', 'order_item', 'shipping_address', 'created_at']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(NameSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with numbers', () => {
      // Given: Table names containing numbers
      const validNames = ['person123', 'product_v2', 'invoice2023', 'item_1']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(NameSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept single character name', () => {
      // Given: A single character table name
      const name = 'a'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('a')
    })

    test('should accept maximum length name (63 characters)', () => {
      // Given: A table name at maximum length (63 characters)
      const maxLengthName = 'a' + '0'.repeat(62) // 63 characters total

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(maxLengthName)

      // Then: The name should be accepted
      expect(result).toBe(maxLengthName)
    })
  })

  describe('invalid values', () => {
    test('should reject empty string', () => {
      // Given: An empty string
      // When: The value is validated against the schema
      // Then: Validation should throw an error with message "This field is required"
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)('')
      }).toThrow('This field is required')
    })

    test('should reject names starting with uppercase letter', () => {
      // Given: Table names starting with uppercase letters
      const invalidNames = ['Person', 'Product', 'InvoiceItem']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(name)
        }).toThrow()
      })
    })

    test('should reject names starting with number', () => {
      // Given: Table names starting with numbers
      const invalidNames = ['1person', '2product', '123invoice']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(name)
        }).toThrow()
      })
    })

    test('should reject names starting with underscore', () => {
      // Given: A table name starting with underscore
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)('_person')
      }).toThrow()
    })

    test('should reject names with hyphens', () => {
      // Given: Table names with hyphens (kebab-case)
      const invalidNames = ['person-profile', 'invoice-item', 'shipping-address']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(name)
        }).toThrow()
      })
    })

    test('should reject names with spaces', () => {
      // Given: Table names containing spaces
      const invalidNames = ['person profile', 'invoice item', 'person name']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(name)
        }).toThrow()
      })
    })

    test('should reject names with special characters', () => {
      // Given: Table names with special characters
      const invalidNames = ['person@profile', 'invoice#item', 'person!name', 'product$price']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(name)
        }).toThrow()
      })
    })

    test('should reject names exceeding 63 characters', () => {
      // Given: A table name exceeding 63 characters
      const tooLongName = 'a' + '0'.repeat(63) // 64 characters total

      // When: The name is validated against the schema
      // Then: Validation should throw an error with message "Maximum length is 63 characters"
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(tooLongName)
      }).toThrow('Maximum length is 63 characters')
    })

    test('should reject non-string values', () => {
      // Given: Non-string values (number, boolean, null, undefined, object, array)
      const invalidValues = [123, true, null, undefined, {}, []]

      // When: Each value is validated against the schema
      // Then: All should throw validation errors
      invalidValues.forEach((value) => {
        expect(() => {
          Schema.decodeUnknownSync(NameSchema)(value)
        }).toThrow()
      })
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid table name with TypeScript type annotation
      const name: Schema.Schema.Type<typeof NameSchema> = 'person'

      // When: TypeScript type inference is applied
      // Then: The type should be correctly inferred as string
      expect(name).toBe('person')
    })
  })
})
