/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ProgressFieldSchema } from './progress-field'

describe('ProgressFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid progress field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'task_completion',
        type: 'progress' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(ProgressFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept progress field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'task_completion',
        type: 'progress' as const,
        required: true,
        color: '#10B981',
      }

      const result = Schema.decodeSync(ProgressFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept progress field with custom color', () => {
      const field = {
        id: 1,
        name: 'project_progress',
        type: 'progress' as const,
        color: '#3B82F6',
      }

      const result = Schema.decodeSync(ProgressFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'task_completion',
        type: 'progress' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(ProgressFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with invalid hex color', () => {
      const field = {
        id: 1,
        name: 'progress',
        type: 'progress' as const,
        color: 'blue',
      }

      expect(() => {
        Schema.decodeSync(ProgressFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with short hex color', () => {
      const field = {
        id: 1,
        name: 'progress',
        type: 'progress' as const,
        color: '#FFF',
      }

      expect(() => {
        Schema.decodeSync(ProgressFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof ProgressFieldSchema> = {
        id: 1,
        name: 'task_completion',
        type: 'progress' as const,
        color: '#10B981',

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
