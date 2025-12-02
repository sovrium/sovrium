/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { ApiKeysConfigSchema } from './api-keys'

describe('ApiKeysConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept boolean true', () => {
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept boolean false', () => {
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(false)
      expect(result).toBe(false)
    })

    test('should accept empty config object', () => {
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)({})
      expect(result).toEqual({})
    })

    test('should accept expirationDays', () => {
      const input = { expirationDays: 90 }
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(input)
      expect(result).toEqual({ expirationDays: 90 })
    })

    test('should accept expirationDays of 0 (never expire)', () => {
      const input = { expirationDays: 0 }
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(input)
      expect(result).toEqual({ expirationDays: 0 })
    })

    test('should accept rateLimit', () => {
      const input = { rateLimit: 1000 }
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(input)
      expect(result).toEqual({ rateLimit: 1000 })
    })

    test('should accept maxKeysPerUser', () => {
      const input = { maxKeysPerUser: 5 }
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(input)
      expect(result).toEqual({ maxKeysPerUser: 5 })
    })

    test('should accept full configuration', () => {
      const input = {
        expirationDays: 90,
        rateLimit: 1000,
        maxKeysPerUser: 5,
      }
      const result = Schema.decodeUnknownSync(ApiKeysConfigSchema)(input)
      expect(result).toEqual(input)
    })
  })

  describe('invalid configurations', () => {
    test('should reject negative expirationDays', () => {
      expect(() => Schema.decodeUnknownSync(ApiKeysConfigSchema)({ expirationDays: -1 })).toThrow()
    })

    test('should reject zero rateLimit', () => {
      expect(() => Schema.decodeUnknownSync(ApiKeysConfigSchema)({ rateLimit: 0 })).toThrow()
    })

    test('should reject negative rateLimit', () => {
      expect(() => Schema.decodeUnknownSync(ApiKeysConfigSchema)({ rateLimit: -100 })).toThrow()
    })

    test('should reject zero maxKeysPerUser', () => {
      expect(() => Schema.decodeUnknownSync(ApiKeysConfigSchema)({ maxKeysPerUser: 0 })).toThrow()
    })

    test('should reject string input', () => {
      expect(() => Schema.decodeUnknownSync(ApiKeysConfigSchema)('true')).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(ApiKeysConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('API Keys Plugin Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(ApiKeysConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Programmatic API access with API keys')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(ApiKeysConfigSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toContain(true)
      }
    })
  })
})
