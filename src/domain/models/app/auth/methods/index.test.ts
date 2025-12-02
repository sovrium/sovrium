/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthenticationMethodLiteralSchema, AuthenticationMethodSchema, getMethodName } from '.'

describe('AuthenticationMethodSchema', () => {
  describe('valid string methods', () => {
    test('should accept email-and-password string', () => {
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)('email-and-password')
      expect(result).toBe('email-and-password')
    })

    test('should accept magic-link string', () => {
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)('magic-link')
      expect(result).toBe('magic-link')
    })

    test('should accept passkey string', () => {
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)('passkey')
      expect(result).toBe('passkey')
    })
  })

  describe('valid config objects', () => {
    test('should accept email-and-password config', () => {
      const input = { method: 'email-and-password', minPasswordLength: 12 }
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)
      expect(result).toEqual({ method: 'email-and-password', minPasswordLength: 12 })
    })

    test('should accept email-and-password with requireEmailVerification', () => {
      const input = { method: 'email-and-password', requireEmailVerification: true }
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)
      expect(result).toEqual({ method: 'email-and-password', requireEmailVerification: true })
    })

    test('should accept magic-link config', () => {
      const input = { method: 'magic-link', expirationMinutes: 30 }
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)
      expect(result).toEqual({ method: 'magic-link', expirationMinutes: 30 })
    })

    test('should accept passkey config', () => {
      const input = { method: 'passkey', userVerification: 'required' }
      const result = Schema.decodeUnknownSync(AuthenticationMethodSchema)(input)
      expect(result).toEqual({ method: 'passkey', userVerification: 'required' })
    })
  })

  describe('invalid inputs', () => {
    test('should reject unknown method string', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)('unknown-method')).toThrow()
    })

    test('should reject invalid config object', () => {
      expect(() =>
        Schema.decodeUnknownSync(AuthenticationMethodSchema)({ method: 'invalid' })
      ).toThrow()
    })

    test('should reject number', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(123)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)(null)).toThrow()
    })

    test('should reject removed method email-otp', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)('email-otp')).toThrow()
    })

    test('should reject removed method phone-number', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)('phone-number')).toThrow()
    })

    test('should reject removed method username', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)('username')).toThrow()
    })

    test('should reject removed method anonymous', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodSchema)('anonymous')).toThrow()
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
        expect(description.value).toBe(
          'Available authentication methods (can be string or config object)'
        )
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthenticationMethodSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toContain('email-and-password')
        expect(examples.value).toContain('magic-link')
        expect(examples.value).toContain('passkey')
      }
    })
  })
})

describe('AuthenticationMethodLiteralSchema', () => {
  describe('valid literals', () => {
    test('should accept all valid method literals', () => {
      const methods = ['email-and-password', 'magic-link', 'passkey'] as const

      for (const method of methods) {
        const result = Schema.decodeUnknownSync(AuthenticationMethodLiteralSchema)(method)
        expect(result).toBe(method)
      }
    })
  })

  describe('invalid inputs', () => {
    test('should reject unknown method', () => {
      expect(() => Schema.decodeUnknownSync(AuthenticationMethodLiteralSchema)('unknown')).toThrow()
    })

    test('should reject object', () => {
      expect(() =>
        Schema.decodeUnknownSync(AuthenticationMethodLiteralSchema)({
          method: 'email-and-password',
        })
      ).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(AuthenticationMethodLiteralSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Authentication Method Literal')
      }
    })
  })
})

describe('getMethodName', () => {
  test('should return string method as-is', () => {
    expect(getMethodName('email-and-password')).toBe('email-and-password')
    expect(getMethodName('magic-link')).toBe('magic-link')
    expect(getMethodName('passkey')).toBe('passkey')
  })

  test('should extract method from config object', () => {
    expect(getMethodName({ method: 'email-and-password', minPasswordLength: 12 })).toBe(
      'email-and-password'
    )
    expect(getMethodName({ method: 'passkey', userVerification: 'required' })).toBe('passkey')
    expect(getMethodName({ method: 'magic-link', expirationMinutes: 30 })).toBe('magic-link')
  })

  test('should handle all method types as strings', () => {
    const methods = ['email-and-password', 'magic-link', 'passkey'] as const

    for (const method of methods) {
      expect(getMethodName(method)).toBe(method)
    }
  })

  test('should handle all method types as config objects', () => {
    const configs = [
      { method: 'email-and-password' as const },
      { method: 'magic-link' as const },
      { method: 'passkey' as const },
    ]

    for (const config of configs) {
      expect(getMethodName(config)).toBe(config.method)
    }
  })
})
