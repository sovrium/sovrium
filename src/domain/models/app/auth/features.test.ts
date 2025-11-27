/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthFeatureSchema } from './features'

describe('AuthFeatureSchema', () => {
  describe('valid values', () => {
    test('should accept "admin"', () => {
      const input = 'admin'
      const result = Schema.decodeUnknownSync(AuthFeatureSchema)(input)
      expect(result).toBe('admin')
    })

    test('should accept "organization"', () => {
      const input = 'organization'
      const result = Schema.decodeUnknownSync(AuthFeatureSchema)(input)
      expect(result).toBe('organization')
    })
  })

  describe('invalid values', () => {
    test('should reject unknown feature', () => {
      const input = 'unknown-feature'
      expect(() => Schema.decodeUnknownSync(AuthFeatureSchema)(input)).toThrow()
    })

    test('should reject number', () => {
      const input = 123
      expect(() => Schema.decodeUnknownSync(AuthFeatureSchema)(input)).toThrow()
    })

    test('should reject boolean', () => {
      const input = true
      expect(() => Schema.decodeUnknownSync(AuthFeatureSchema)(input)).toThrow()
    })

    test('should reject null', () => {
      const input = null
      expect(() => Schema.decodeUnknownSync(AuthFeatureSchema)(input)).toThrow()
    })

    test('should reject object', () => {
      const input = { enabled: true }
      expect(() => Schema.decodeUnknownSync(AuthFeatureSchema)(input)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AuthFeatureSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Authentication Feature')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(AuthFeatureSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Available authentication features')
      }
    })
  })
})
