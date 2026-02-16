/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { DateFieldSchema } from './date-field'

describe('DateFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid date field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'due_date',
        type: 'date' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(DateFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept valid name patterns', () => {
      const validNames = ['due_date', 'created_at', 'appointment', 'field123', 'a']

      validNames.forEach((name) => {
        const field = {
          id: 1,
          name,
          type: 'datetime' as const,
        }
        const result = Schema.decodeSync(DateFieldSchema)(field)
        expect(result.name).toBe(name)
      })
    })

    test('should accept all valid date field types', () => {
      const validTypes = ['date', 'datetime', 'time']

      validTypes.forEach((type) => {
        const field = {
          id: 1,
          name: 'test_field',
          type,
        }
        // @ts-expect-error - Testing dynamic type from array
        const result = Schema.decodeSync(DateFieldSchema)(field)
        // @ts-expect-error - TypeScript can't narrow the dynamic type
        expect(result.type).toBe(type)
      })
    })

    test('should accept date field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'due_date',
        type: 'datetime' as const,
        required: true,
        unique: false,
        indexed: true,
        format: 'YYYY-MM-DD',
        includeTime: true,
        timezone: 'America/New_York',
        default: '2025-01-01',
      }

      const result = Schema.decodeSync(DateFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept date field with time', () => {
      const field = {
        id: 1,
        name: 'appointment',
        type: 'time' as const,
        includeTime: true,
        timezone: 'UTC',
      }

      const result = Schema.decodeSync(DateFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'due_date',
        type: 'date' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(DateFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without type', () => {
      const field = {
        id: 1,
        name: 'due_date',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: type
        Schema.decodeSync(DateFieldSchema)(field)
      }).toThrow()
    })

    test('should reject invalid name patterns', () => {
      const invalidNames = [
        'DueDate', // uppercase
        '123date', // starts with number
        'due-date', // contains hyphen
        'Due Date', // contains space
        '', // empty
      ]

      invalidNames.forEach((name) => {
        const field = {
          id: 1,
          name,
          type: 'date' as const,
        }
        expect(() => {
          Schema.decodeSync(DateFieldSchema)(field)
        }).toThrow()
      })
    })

    test('should reject name exceeding 63 characters', () => {
      const field = {
        id: 1,
        name: 'a'.repeat(64),
        type: 'date' as const,
      }

      expect(() => {
        Schema.decodeSync(DateFieldSchema)(field)
      }).toThrow()
    })

    test('should reject invalid type values', () => {
      const invalidTypes = ['timestamp', 'timestamptz', 'interval', 'invalid']

      invalidTypes.forEach((type) => {
        const field = {
          id: 1,
          name: 'test_field',
          type,
        }
        expect(() => {
          // @ts-expect-error - Testing invalid type values
          Schema.decodeSync(DateFieldSchema)(field)
        }).toThrow()
      })
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof DateFieldSchema> = {
        id: 1,
        name: 'due_date',
        type: 'date' as const,
        format: 'YYYY-MM-DD',

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
