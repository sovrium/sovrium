/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { EmailAndPasswordConfigSchema } from './email-and-password'
import { MagicLinkConfigSchema } from './magic-link'

describe('EmailAndPasswordConfigSchema', () => {
  describe('valid boolean', () => {
    test('should accept true', () => {
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept false', () => {
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(false)
      expect(result).toBe(false)
    })
  })

  describe('valid config objects', () => {
    test('should accept config with requireEmailVerification', () => {
      const input = { requireEmailVerification: true }
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(input)
      expect(result).toEqual({ requireEmailVerification: true })
    })

    test('should accept config with minPasswordLength', () => {
      const input = { minPasswordLength: 12 }
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(input)
      expect(result).toEqual({ minPasswordLength: 12 })
    })

    test('should accept config with maxPasswordLength', () => {
      const input = { maxPasswordLength: 128 }
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(input)
      expect(result).toEqual({ maxPasswordLength: 128 })
    })

    test('should accept config with all options', () => {
      const input = {
        requireEmailVerification: true,
        minPasswordLength: 12,
        maxPasswordLength: 128,
      }
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)(input)
      expect(result).toEqual({
        requireEmailVerification: true,
        minPasswordLength: 12,
        maxPasswordLength: 128,
      })
    })

    test('should accept empty config object', () => {
      const result = Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)({})
      expect(result).toEqual({})
    })
  })

  describe('invalid inputs', () => {
    test('should reject minPasswordLength below 6', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)({ minPasswordLength: 5 })
      ).toThrow()
    })

    test('should reject minPasswordLength above 128', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)({ minPasswordLength: 129 })
      ).toThrow()
    })

    test('should reject maxPasswordLength below 8', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)({ maxPasswordLength: 7 })
      ).toThrow()
    })

    test('should reject maxPasswordLength above 256', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordConfigSchema)({ maxPasswordLength: 257 })
      ).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(EmailAndPasswordConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Email and Password Configuration')
      }
    })
  })
})

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
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(MagicLinkConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Magic Link Configuration')
      }
    })
  })
})
