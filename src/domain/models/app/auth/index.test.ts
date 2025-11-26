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
    test('should accept full auth configuration', () => {
      const input = {
        enabled: true,
        emailAndPassword: { enabled: true },
        plugins: {
          admin: { enabled: true },
          organization: { enabled: true },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: true,
        emailAndPassword: { enabled: true },
        plugins: {
          admin: { enabled: true },
          organization: { enabled: true },
        },
      })
    })

    test('should accept auth with only emailAndPassword', () => {
      const input = {
        enabled: true,
        emailAndPassword: { enabled: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: true,
        emailAndPassword: { enabled: true },
      })
    })

    test('should accept auth with only plugins', () => {
      const input = {
        enabled: true,
        plugins: {
          admin: { enabled: true },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: true,
        plugins: {
          admin: { enabled: true },
        },
      })
    })

    test('should accept minimal auth configuration (enabled only)', () => {
      const input = {
        enabled: true,
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: true,
      })
    })

    test('should accept disabled auth', () => {
      const input = {
        enabled: false,
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: false,
      })
    })

    test('should accept auth with all plugins disabled', () => {
      const input = {
        enabled: true,
        emailAndPassword: { enabled: false },
        plugins: {
          admin: { enabled: false },
          organization: { enabled: false },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        enabled: true,
        emailAndPassword: { enabled: false },
        plugins: {
          admin: { enabled: false },
          organization: { enabled: false },
        },
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing enabled field', () => {
      const input = {
        emailAndPassword: { enabled: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject enabled as string', () => {
      const input = {
        enabled: 'true',
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject enabled as number', () => {
      const input = {
        enabled: 1,
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject invalid emailAndPassword', () => {
      const input = {
        enabled: true,
        emailAndPassword: { enabled: 'true' },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject invalid plugins', () => {
      const input = {
        enabled: true,
        plugins: {
          admin: { enabled: 'true' },
        },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        enabled: true,
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({ enabled: true })
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
          'Complete authentication configuration including providers and optional plugins'
        )
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toEqual([
          {
            enabled: true,
            emailAndPassword: { enabled: true },
            plugins: {
              admin: { enabled: true },
              organization: { enabled: true },
            },
          },
          {
            enabled: true,
            emailAndPassword: { enabled: true },
          },
          {
            enabled: false,
          },
        ])
      }
    })
  })
})
