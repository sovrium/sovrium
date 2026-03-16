/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { createDatabaseIdentifierSchema } from './database-identifier'

describe('createDatabaseIdentifierSchema', () => {
  describe('table identifier validation', () => {
    const TableIdentifierSchema = createDatabaseIdentifierSchema('table')

    test('should accept valid lowercase table names', () => {
      // Given: Valid lowercase table names (non-reserved keywords)
      const validNames = ['person', 'product', 'customer', 'invoice']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with underscores', () => {
      // Given: Table names with underscores (snake_case)
      const validNames = ['person_profile', 'order_item', 'shipping_address', 'created_at']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with mixed case (user-friendly format)', () => {
      // Given: Table names with mixed case (will be sanitized to lowercase)
      const validNames = ['Person', 'Product', 'InvoiceItem']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with spaces (user-friendly format)', () => {
      // Given: Table names with spaces (will be sanitized to underscores)
      const validNames = ['person profile', 'order item', 'Customer Orders']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept names with numbers', () => {
      // Given: Table names containing numbers
      const validNames = ['person123', 'product_v2', 'invoice2023', 'item_1']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should accept maximum length (63 characters)', () => {
      // Given: A name at maximum length (63 characters)
      const maxLengthName = 'a' + '0'.repeat(62) // 63 characters total

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(TableIdentifierSchema)(maxLengthName)

      // Then: The name should be accepted
      expect(result).toBe(maxLengthName)
    })

    test('should reject empty string', () => {
      // Given: An empty string
      // When: The value is validated against the schema
      // Then: Validation should throw an error with message "This field is required"
      expect(() => {
        Schema.decodeUnknownSync(TableIdentifierSchema)('')
      }).toThrow('This field is required')
    })

    test('should reject names exceeding 63 characters', () => {
      // Given: A name exceeding 63 characters
      const tooLongName = 'a' + '0'.repeat(63) // 64 characters total

      // When: The name is validated against the schema
      // Then: Validation should throw an error with message "Maximum length is 63 characters"
      expect(() => {
        Schema.decodeUnknownSync(TableIdentifierSchema)(tooLongName)
      }).toThrow('Maximum length is 63 characters')
    })

    test('should reject reserved SQL keywords', () => {
      // Given: Table names that are reserved SQL keywords
      const invalidNames = ['select', 'insert', 'delete', 'table', 'user']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors with reserved keyword message
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        }).toThrow(/reserved|keyword/i)
      })
    })

    test('should reject names that sanitize to reserved keywords', () => {
      // Given: Table names that sanitize to reserved keywords
      const invalidNames = ['SELECT', 'Insert', 'DELETE', 'User']

      // When: Each name is validated against the schema
      // Then: All should throw validation errors with reserved keyword message
      invalidNames.forEach((name) => {
        expect(() => {
          Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        }).toThrow(/reserved|keyword/i)
      })
    })
  })

  describe('field identifier validation', () => {
    const FieldIdentifierSchema = createDatabaseIdentifierSchema('field')

    test('should accept valid lowercase field names', () => {
      // Given: Valid lowercase field names
      const validNames = ['email', 'person_status', 'order_item', 'created_at']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(FieldIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should include correct identifier type in error message', () => {
      // Given: An invalid field name
      // When: The name is validated against the schema
      // Then: Error message should mention "field"
      try {
        Schema.decodeUnknownSync(FieldIdentifierSchema)('Invalid!')
      } catch (error) {
        expect(String(error)).toMatch(/field/)
      }
    })
  })

  describe('column identifier validation', () => {
    const ColumnIdentifierSchema = createDatabaseIdentifierSchema('column')

    test('should accept valid lowercase column names', () => {
      // Given: Valid lowercase column names
      const validNames = ['id', 'name', 'email', 'created_at']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(ColumnIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })

    test('should include correct identifier type in error message', () => {
      // Given: An invalid column name
      // When: The name is validated against the schema
      // Then: Error message should mention "column"
      try {
        Schema.decodeUnknownSync(ColumnIdentifierSchema)('Invalid!')
      } catch (error) {
        expect(String(error)).toMatch(/column/)
      }
    })
  })

  describe('shared validation rules', () => {
    test('all identifier types should enforce same pattern', () => {
      // Given: Different identifier types
      const tableSchema = createDatabaseIdentifierSchema('table')
      const fieldSchema = createDatabaseIdentifierSchema('field')
      const columnSchema = createDatabaseIdentifierSchema('column')

      // When: Same valid name is tested against all schemas
      const validName = 'valid_name_123'

      // Then: All should accept the name
      expect(Schema.decodeUnknownSync(tableSchema)(validName)).toBe(validName)
      expect(Schema.decodeUnknownSync(fieldSchema)(validName)).toBe(validName)
      expect(Schema.decodeUnknownSync(columnSchema)(validName)).toBe(validName)
    })

    test('all identifier types should enforce same length limits', () => {
      // Given: Different identifier types
      const tableSchema = createDatabaseIdentifierSchema('table')
      const fieldSchema = createDatabaseIdentifierSchema('field')
      const columnSchema = createDatabaseIdentifierSchema('column')

      // When: Same invalid name (too long) is tested against all schemas
      const tooLongName = 'a'.repeat(64)

      // Then: All should reject the name
      expect(() => Schema.decodeUnknownSync(tableSchema)(tooLongName)).toThrow(
        'Maximum length is 63 characters'
      )
      expect(() => Schema.decodeUnknownSync(fieldSchema)(tooLongName)).toThrow(
        'Maximum length is 63 characters'
      )
      expect(() => Schema.decodeUnknownSync(columnSchema)(tooLongName)).toThrow(
        'Maximum length is 63 characters'
      )
    })
  })

  describe('reserved SQL keyword validation', () => {
    const TableIdentifierSchema = createDatabaseIdentifierSchema('table')

    test('should reject common SQL reserved keywords', () => {
      // Given: Reserved SQL keywords
      const reservedKeywords = [
        'select',
        'insert',
        'update',
        'delete',
        'user',
        'order',
        'group',
        'table',
      ]

      // When: Each keyword is validated against the schema
      // Then: All should throw validation errors mentioning reserved keywords
      reservedKeywords.forEach((keyword) => {
        expect(() => {
          Schema.decodeUnknownSync(TableIdentifierSchema)(keyword)
        }).toThrow(/reserved.*keyword/i)
      })
    })

    test('should allow non-reserved names that are similar to keywords', () => {
      // Given: Names similar to keywords but not reserved
      const validNames = ['person', 'customer', 'invoice', 'product']

      // When: Each name is validated against the schema
      // Then: All names should be accepted
      validNames.forEach((name) => {
        const result = Schema.decodeUnknownSync(TableIdentifierSchema)(name)
        expect(result).toBe(name)
      })
    })
  })
})
