/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { getEnabledMethods, hasAnyMethodEnabled, isMethodEnabled, MethodsConfigSchema } from '.'

describe('MethodsConfigSchema', () => {
  describe('valid boolean methods', () => {
    test('should accept emailAndPassword as boolean', () => {
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)({ emailAndPassword: true })
      expect(result).toEqual({ emailAndPassword: true })
    })

    test('should accept magicLink as boolean', () => {
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)({ magicLink: true })
      expect(result).toEqual({ magicLink: true })
    })

    test('should accept passkey as boolean', () => {
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)({ passkey: true })
      expect(result).toEqual({ passkey: true })
    })

    test('should accept multiple methods', () => {
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)({
        emailAndPassword: true,
        magicLink: true,
        passkey: true,
      })
      expect(result).toEqual({
        emailAndPassword: true,
        magicLink: true,
        passkey: true,
      })
    })
  })

  describe('valid config objects', () => {
    test('should accept emailAndPassword config', () => {
      const input = { emailAndPassword: { minPasswordLength: 12 } }
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)(input)
      expect(result).toEqual({ emailAndPassword: { minPasswordLength: 12 } })
    })

    test('should accept emailAndPassword with requireEmailVerification', () => {
      const input = { emailAndPassword: { requireEmailVerification: true } }
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)(input)
      expect(result).toEqual({ emailAndPassword: { requireEmailVerification: true } })
    })

    test('should accept magicLink config', () => {
      const input = { magicLink: { expirationMinutes: 30 } }
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)(input)
      expect(result).toEqual({ magicLink: { expirationMinutes: 30 } })
    })

    test('should accept passkey config', () => {
      const input = { passkey: { userVerification: 'required' } }
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)(input)
      expect(result).toEqual({ passkey: { userVerification: 'required' } })
    })

    test('should accept mixed boolean and config', () => {
      const input = {
        emailAndPassword: { requireEmailVerification: true },
        magicLink: true,
      }
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)(input)
      expect(result).toEqual({
        emailAndPassword: { requireEmailVerification: true },
        magicLink: true,
      })
    })
  })

  describe('empty config', () => {
    test('should accept empty object', () => {
      const result = Schema.decodeUnknownSync(MethodsConfigSchema)({})
      expect(result).toEqual({})
    })
  })

  describe('invalid inputs', () => {
    test('should reject array (old format)', () => {
      expect(() => Schema.decodeUnknownSync(MethodsConfigSchema)(['email-and-password'])).toThrow()
    })

    test('should reject string', () => {
      expect(() => Schema.decodeUnknownSync(MethodsConfigSchema)('emailAndPassword')).toThrow()
    })

    test('should reject number', () => {
      expect(() => Schema.decodeUnknownSync(MethodsConfigSchema)(123)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(MethodsConfigSchema)(null)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(MethodsConfigSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Methods Configuration')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(MethodsConfigSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('All authentication methods configuration')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(MethodsConfigSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('isMethodEnabled', () => {
  test('should return true for boolean true', () => {
    expect(isMethodEnabled({ emailAndPassword: true }, 'emailAndPassword')).toBe(true)
    expect(isMethodEnabled({ magicLink: true }, 'magicLink')).toBe(true)
    expect(isMethodEnabled({ passkey: true }, 'passkey')).toBe(true)
  })

  test('should return false for boolean false', () => {
    expect(isMethodEnabled({ emailAndPassword: false }, 'emailAndPassword')).toBe(false)
  })

  test('should return true for config object', () => {
    expect(
      isMethodEnabled({ emailAndPassword: { minPasswordLength: 12 } }, 'emailAndPassword')
    ).toBe(true)
  })

  test('should return false for undefined method', () => {
    expect(isMethodEnabled({ emailAndPassword: true }, 'passkey')).toBe(false)
  })

  test('should return false for undefined methods', () => {
    expect(isMethodEnabled(undefined, 'emailAndPassword')).toBe(false)
  })
})

describe('getEnabledMethods', () => {
  test('should return all enabled methods', () => {
    const methods = { emailAndPassword: true, magicLink: true }
    const enabled = getEnabledMethods(methods)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toContain('magicLink')
    expect(enabled).toHaveLength(2)
  })

  test('should exclude disabled methods', () => {
    const methods = { emailAndPassword: true, magicLink: false }
    const enabled = getEnabledMethods(methods)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).not.toContain('magicLink')
    expect(enabled).toHaveLength(1)
  })

  test('should include methods with config objects', () => {
    const methods = { emailAndPassword: { requireEmailVerification: true } }
    const enabled = getEnabledMethods(methods)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toHaveLength(1)
  })

  test('should return empty array for undefined', () => {
    expect(getEnabledMethods(undefined)).toEqual([])
  })

  test('should return empty array for empty object', () => {
    expect(getEnabledMethods({})).toEqual([])
  })
})

describe('hasAnyMethodEnabled', () => {
  test('should return true when at least one method is enabled', () => {
    expect(hasAnyMethodEnabled({ emailAndPassword: true })).toBe(true)
    expect(hasAnyMethodEnabled({ magicLink: true, passkey: false })).toBe(true)
  })

  test('should return false when no methods are enabled', () => {
    expect(hasAnyMethodEnabled({})).toBe(false)
    expect(hasAnyMethodEnabled({ emailAndPassword: false })).toBe(false)
  })

  test('should return false for undefined', () => {
    expect(hasAnyMethodEnabled(undefined)).toBe(false)
  })
})
