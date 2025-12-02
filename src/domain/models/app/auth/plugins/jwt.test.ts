/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { JWTConfigSchema } from './jwt'

describe('JWTConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept boolean true', () => {
      const result = Schema.decodeUnknownSync(JWTConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept boolean false', () => {
      const result = Schema.decodeUnknownSync(JWTConfigSchema)(false)
      expect(result).toBe(false)
    })
  })

  describe('invalid configurations', () => {
    test('should reject string input', () => {
      expect(() => Schema.decodeUnknownSync(JWTConfigSchema)('true')).toThrow()
    })

    test('should reject object input', () => {
      expect(() => Schema.decodeUnknownSync(JWTConfigSchema)({})).toThrow()
    })

    test('should reject number input', () => {
      expect(() => Schema.decodeUnknownSync(JWTConfigSchema)(1)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(JWTConfigSchema)(null)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(JWTConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('JWT Plugin')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(JWTConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Enable JWT token mode for authentication')
      }
    })
  })
})
