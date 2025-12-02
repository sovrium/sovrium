/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { TwoFactorConfigSchema } from './two-factor'

describe('TwoFactorConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept boolean true', () => {
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept boolean false', () => {
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(false)
      expect(result).toBe(false)
    })

    test('should accept empty config object', () => {
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)({})
      expect(result).toEqual({})
    })

    test('should accept issuer', () => {
      const input = { issuer: 'MyApp' }
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(input)
      expect(result).toEqual({ issuer: 'MyApp' })
    })

    test('should accept backupCodes', () => {
      const input = { backupCodes: true }
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(input)
      expect(result).toEqual({ backupCodes: true })
    })

    test('should accept digits within valid range', () => {
      for (const digits of [4, 5, 6, 7, 8]) {
        const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)({ digits })
        expect(result).toEqual({ digits })
      }
    })

    test('should accept period', () => {
      const input = { period: 60 }
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(input)
      expect(result).toEqual({ period: 60 })
    })

    test('should accept full configuration', () => {
      const input = {
        issuer: 'MyApp',
        backupCodes: true,
        digits: 6,
        period: 30,
      }
      const result = Schema.decodeUnknownSync(TwoFactorConfigSchema)(input)
      expect(result).toEqual(input)
    })
  })

  describe('invalid configurations', () => {
    test('should reject digits below minimum (4)', () => {
      expect(() => Schema.decodeUnknownSync(TwoFactorConfigSchema)({ digits: 3 })).toThrow()
    })

    test('should reject digits above maximum (8)', () => {
      expect(() => Schema.decodeUnknownSync(TwoFactorConfigSchema)({ digits: 9 })).toThrow()
    })

    test('should reject negative period', () => {
      expect(() => Schema.decodeUnknownSync(TwoFactorConfigSchema)({ period: -30 })).toThrow()
    })

    test('should reject zero period', () => {
      expect(() => Schema.decodeUnknownSync(TwoFactorConfigSchema)({ period: 0 })).toThrow()
    })

    test('should reject string input', () => {
      expect(() => Schema.decodeUnknownSync(TwoFactorConfigSchema)('true')).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(TwoFactorConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Two-Factor Authentication Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(TwoFactorConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('TOTP-based two-factor authentication')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(TwoFactorConfigSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toContain(true)
      }
    })
  })
})
