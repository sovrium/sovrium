/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthenticationMethodSchema } from './email-and-password'

describe('AuthenticationMethodSchema', () => {
  describe('valid values', () => {
    test('should accept "email-and-password"', () => {
      const input = 'email-and-password'
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)
      expect(result).toBe('email-and-password')
    })
  })

  describe('invalid values', () => {
    test('should reject unknown authentication method', () => {
      const input = 'unknown-method'
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)).toThrow()
    })

    test('should reject number', () => {
      const input = 123
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)).toThrow()
    })

    test('should reject boolean', () => {
      const input = true
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)).toThrow()
    })

    test('should reject null', () => {
      const input = null
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)).toThrow()
    })

    test('should reject object', () => {
      const input = { enabled: true }
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AuthenticationMethodSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Authentication Method')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(AuthenticationMethodSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Available authentication methods')
      }
    })
  })
})
