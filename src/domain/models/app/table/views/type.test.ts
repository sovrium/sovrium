/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewTypeSchema } from './type'

describe('ViewTypeSchema', () => {
  describe('Valid Types', () => {
    test.each(['grid', 'kanban', 'calendar', 'gallery', 'form', 'list'] as const)(
      'should accept view type: %s',
      (type) => {
        // GIVEN: A valid view type
        // WHEN: The type is validated against the schema
        const result = Schema.decodeUnknownSync(ViewTypeSchema)(type)

        // THEN: The type should be accepted
        expect(result).toBe(type)
      }
    )
  })

  describe('Invalid Types', () => {
    test('should reject invalid type string', () => {
      // GIVEN: An invalid type
      const type = 'table'

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject spreadsheet type', () => {
      // GIVEN: A spreadsheet type
      const type = 'spreadsheet'

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject number', () => {
      // GIVEN: A number
      const type = 1

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const type = null

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // GIVEN: An undefined value
      const type = undefined

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject empty string', () => {
      // GIVEN: An empty string
      const type = ''

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject uppercase variant', () => {
      // GIVEN: An uppercase variant of a valid type
      const type = 'GRID'

      // WHEN/THEN: The type validation should fail (case-sensitive)
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })

    test('should reject object', () => {
      // GIVEN: An object
      const type = { type: 'grid' }

      // WHEN/THEN: The type validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewTypeSchema)(type)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewType correctly', () => {
      // GIVEN: A valid type
      const type = 'kanban' as const

      // WHEN: The type is validated against the schema
      const result = Schema.decodeUnknownSync(ViewTypeSchema)(type)

      // THEN: TypeScript should infer the correct type
      expect(result).toBe('kanban')
    })
  })
})
