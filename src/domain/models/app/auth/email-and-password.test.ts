/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { EmailAndPasswordProviderSchema } from './email-and-password'

describe('EmailAndPasswordProviderSchema', () => {
  describe('valid configurations', () => {
    test('should accept enabled: true', () => {
      const input = { enabled: true }
      const result = Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)
      expect(result).toEqual({ enabled: true })
    })

    test('should accept enabled: false', () => {
      const input = { enabled: false }
      const result = Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)
      expect(result).toEqual({ enabled: false })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing enabled field', () => {
      const input = {}
      expect(() => Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)).toThrow()
    })

    test('should reject enabled as string', () => {
      const input = { enabled: 'true' }
      expect(() => Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)).toThrow()
    })

    test('should reject enabled as number', () => {
      const input = { enabled: 1 }
      expect(() => Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)).toThrow()
    })

    test('should reject enabled as null', () => {
      const input = { enabled: null }
      expect(() => Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)).toThrow()
    })

    test('should strip extra fields (Effect Schema default behavior)', () => {
      const input = { enabled: true, extraField: 'value' }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(EmailAndPasswordProviderSchema)(input)
      expect(result).toEqual({ enabled: true })
      expect(result).not.toHaveProperty('extraField')
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(EmailAndPasswordProviderSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Email and Password Provider')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(EmailAndPasswordProviderSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toBe('Configuration for email and password authentication')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(EmailAndPasswordProviderSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toEqual([{ enabled: true }, { enabled: false }])
      }
    })
  })
})
