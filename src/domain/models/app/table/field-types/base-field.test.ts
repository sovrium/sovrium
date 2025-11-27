/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

describe('BaseFieldSchema', () => {
  describe('valid base fields', () => {
    test('should accept minimal field', () => {
      const field = { id: 1, name: 'email' }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with required', () => {
      const field = { id: 1, name: 'email', required: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with unique', () => {
      const field = { id: 1, name: 'email', unique: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with indexed', () => {
      const field = { id: 1, name: 'status', indexed: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with all properties', () => {
      const field = {
        id: 1,
        name: 'salary',
        required: true,
        unique: false,
        indexed: true,
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with large numeric id', () => {
      // IdSchema requires positive integers >= 1
      const field = { id: 999, name: 'email' }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result.id).toBe(999)
      expect(result.name).toBe('email')
    })
  })

  describe('invalid base fields', () => {
    test('should reject missing id', () => {
      const field = { name: 'email' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject missing name', () => {
      const field = { id: 1 }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject empty name', () => {
      const field = { id: 1, name: '' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject non-boolean required', () => {
      const field = { id: 1, name: 'email', required: 'yes' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(null)).toThrow()
    })
  })
})
