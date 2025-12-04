/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { CountFieldSchema } from './count-field'

describe('CountFieldSchema', () => {
  describe('Valid count fields', () => {
    test('should validate basic count field', () => {
      const input = {
        id: 1,
        name: 'task_count',
        type: 'count' as const,
        relationshipField: 'project_id',
      }

      const result = Schema.decodeUnknownSync(CountFieldSchema)(input)
      expect(result).toEqual(input)
    })

    test('should validate count field with conditions', () => {
      const input = {
        id: 1,
        name: 'completed_count',
        type: 'count' as const,
        relationshipField: 'project_id',
        conditions: { field: 'status', operator: 'equals', value: 'completed' },
      }

      const result = Schema.decodeUnknownSync(CountFieldSchema)(input)
      expect(result).toEqual(input)
    })

    test('should validate count field with optional properties', () => {
      const input = {
        id: 1,
        name: 'task_count',
        type: 'count' as const,
        relationshipField: 'project_id',
        required: true,
        unique: false,
        indexed: true,
      }

      const result = Schema.decodeUnknownSync(CountFieldSchema)(input)
      expect(result).toEqual(input)
    })
  })

  describe('Invalid count fields', () => {
    test('should reject count field without relationshipField', () => {
      const input = {
        id: 1,
        name: 'task_count',
        type: 'count',
      }

      expect(() => Schema.decodeUnknownSync(CountFieldSchema)(input)).toThrow()
    })

    test('should reject count field with empty relationshipField', () => {
      const input = {
        id: 1,
        name: 'task_count',
        type: 'count',
        relationshipField: '',
      }

      expect(() => Schema.decodeUnknownSync(CountFieldSchema)(input)).toThrow()
    })

    test('should reject count field with wrong type', () => {
      const input = {
        id: 1,
        name: 'task_count',
        type: 'lookup',
        relationshipField: 'project_id',
      }

      expect(() => Schema.decodeUnknownSync(CountFieldSchema)(input)).toThrow()
    })
  })
})
