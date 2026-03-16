/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { MagicLinkConfigSchema } from './magic-link'

describe('MagicLinkConfigSchema', () => {
  describe('valid boolean', () => {
    test('should accept true', () => {
      const result = Schema.decodeUnknownSync(MagicLinkConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept false', () => {
      const result = Schema.decodeUnknownSync(MagicLinkConfigSchema)(false)
      expect(result).toBe(false)
    })
  })

  describe('valid config objects', () => {
    test('should accept config with expirationMinutes', () => {
      const input = { expirationMinutes: 30 }
      const result = Schema.decodeUnknownSync(MagicLinkConfigSchema)(input)
      expect(result).toEqual({ expirationMinutes: 30 })
    })

    test('should accept empty config object', () => {
      const result = Schema.decodeUnknownSync(MagicLinkConfigSchema)({})
      expect(result).toEqual({})
    })

    test('should accept expirationMinutes at minimum (1)', () => {
      const result = Schema.decodeUnknownSync(MagicLinkConfigSchema)({ expirationMinutes: 1 })
      expect(result).toEqual({ expirationMinutes: 1 })
    })
  })

  describe('invalid inputs', () => {
    test('should reject negative expirationMinutes', () => {
      expect(() =>
        Schema.decodeUnknownSync(MagicLinkConfigSchema)({ expirationMinutes: -1 })
      ).toThrow()
    })

    test('should reject zero expirationMinutes', () => {
      expect(() =>
        Schema.decodeUnknownSync(MagicLinkConfigSchema)({ expirationMinutes: 0 })
      ).toThrow()
    })

    test('should reject string input', () => {
      expect(() => Schema.decodeUnknownSync(MagicLinkConfigSchema)('true')).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(MagicLinkConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Magic Link Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(MagicLinkConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Configuration for magic link authentication')
      }
    })
  })
})
