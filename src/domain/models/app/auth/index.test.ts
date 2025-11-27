/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthSchema } from '.'

describe('AuthSchema', () => {
  describe('valid configurations', () => {
    test('should accept full auth configuration with all features', () => {
      const input = {
        authentication: ['email-and-password'],
        features: ['admin', 'organization'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        features: ['admin', 'organization'],
      })
    })

    test('should accept auth with only authentication method', () => {
      const input = {
        authentication: ['email-and-password'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
      })
    })

    test('should accept auth with admin feature only', () => {
      const input = {
        authentication: ['email-and-password'],
        features: ['admin'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        features: ['admin'],
      })
    })

    test('should accept auth with organization feature only', () => {
      const input = {
        authentication: ['email-and-password'],
        features: ['organization'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        features: ['organization'],
      })
    })

    test('should accept auth with empty features array', () => {
      const input = {
        authentication: ['email-and-password'],
        features: [],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        features: [],
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing authentication field', () => {
      const input = {
        features: ['admin'],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject empty authentication array', () => {
      const input = {
        authentication: [],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject invalid authentication method', () => {
      const input = {
        authentication: ['unknown-method'],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject invalid feature', () => {
      const input = {
        authentication: ['email-and-password'],
        features: ['unknown-feature'],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject authentication as string', () => {
      const input = {
        authentication: 'email-and-password',
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject features as string', () => {
      const input = {
        authentication: ['email-and-password'],
        features: 'admin',
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        authentication: ['email-and-password'],
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({ authentication: ['email-and-password'] })
      expect(result).not.toHaveProperty('unknownField')
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AuthSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Authentication Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(AuthSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe(
          'Authentication configuration. If present, auth is enabled with specified methods and features.'
        )
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toEqual([
          {
            authentication: ['email-and-password'],
            features: ['admin', 'organization'],
          },
          {
            authentication: ['email-and-password'],
            features: ['admin'],
          },
          {
            authentication: ['email-and-password'],
          },
        ])
      }
    })
  })
})
