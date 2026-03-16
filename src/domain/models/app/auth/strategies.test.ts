/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  EmailAndPasswordStrategySchema,
  MagicLinkStrategySchema,
  OAuthStrategySchema,
  AuthStrategySchema,
  AuthStrategiesSchema,
} from './strategies'

describe('EmailAndPasswordStrategySchema', () => {
  describe('valid values', () => {
    test('should accept minimal strategy', () => {
      const input = { type: 'emailAndPassword' }
      const result = Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)(input)
      expect(result.type).toBe('emailAndPassword')
    })

    test('should accept all optional properties', () => {
      const input = {
        type: 'emailAndPassword' as const,
        minPasswordLength: 12,
        maxPasswordLength: 128,
        requireEmailVerification: true,
        autoSignIn: false,
      }
      const result = Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)(input)
      expect(result).toEqual(input)
    })

    test('should accept minimum password length of 6', () => {
      const input = { type: 'emailAndPassword', minPasswordLength: 6 }
      const result = Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)(input)
      expect(result.minPasswordLength).toBe(6)
    })

    test('should accept maximum password length of 256', () => {
      const input = { type: 'emailAndPassword', maxPasswordLength: 256 }
      const result = Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)(input)
      expect(result.maxPasswordLength).toBe(256)
    })
  })

  describe('invalid values', () => {
    test('should reject wrong type literal', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)({ type: 'magicLink' })
      ).toThrow()
    })

    test('should reject minPasswordLength below 6', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)({
          type: 'emailAndPassword',
          minPasswordLength: 5,
        })
      ).toThrow()
    })

    test('should reject minPasswordLength above 128', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)({
          type: 'emailAndPassword',
          minPasswordLength: 129,
        })
      ).toThrow()
    })

    test('should reject maxPasswordLength below 8', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)({
          type: 'emailAndPassword',
          maxPasswordLength: 7,
        })
      ).toThrow()
    })

    test('should reject maxPasswordLength above 256', () => {
      expect(() =>
        Schema.decodeUnknownSync(EmailAndPasswordStrategySchema)({
          type: 'emailAndPassword',
          maxPasswordLength: 257,
        })
      ).toThrow()
    })
  })
})

describe('MagicLinkStrategySchema', () => {
  describe('valid values', () => {
    test('should accept minimal strategy', () => {
      const input = { type: 'magicLink' }
      const result = Schema.decodeUnknownSync(MagicLinkStrategySchema)(input)
      expect(result.type).toBe('magicLink')
    })

    test('should accept with expiration minutes', () => {
      const input = { type: 'magicLink', expirationMinutes: 30 }
      const result = Schema.decodeUnknownSync(MagicLinkStrategySchema)(input)
      expect(result.expirationMinutes).toBe(30)
    })
  })

  describe('invalid values', () => {
    test('should reject wrong type literal', () => {
      expect(() =>
        Schema.decodeUnknownSync(MagicLinkStrategySchema)({ type: 'emailAndPassword' })
      ).toThrow()
    })

    test('should reject non-positive expiration', () => {
      expect(() =>
        Schema.decodeUnknownSync(MagicLinkStrategySchema)({
          type: 'magicLink',
          expirationMinutes: 0,
        })
      ).toThrow()
    })

    test('should reject negative expiration', () => {
      expect(() =>
        Schema.decodeUnknownSync(MagicLinkStrategySchema)({
          type: 'magicLink',
          expirationMinutes: -5,
        })
      ).toThrow()
    })
  })
})

describe('OAuthStrategySchema', () => {
  describe('valid values', () => {
    test('should accept single provider', () => {
      const input = { type: 'oauth', providers: ['google'] }
      const result = Schema.decodeUnknownSync(OAuthStrategySchema)(input)
      expect(result.providers).toEqual(['google'])
    })

    test('should accept multiple providers', () => {
      const input = { type: 'oauth', providers: ['google', 'github', 'slack'] }
      const result = Schema.decodeUnknownSync(OAuthStrategySchema)(input)
      expect(result.providers).toHaveLength(3)
    })
  })

  describe('invalid values', () => {
    test('should reject empty providers array', () => {
      expect(() =>
        Schema.decodeUnknownSync(OAuthStrategySchema)({ type: 'oauth', providers: [] })
      ).toThrow()
    })

    test('should reject missing providers', () => {
      expect(() => Schema.decodeUnknownSync(OAuthStrategySchema)({ type: 'oauth' })).toThrow()
    })

    test('should reject invalid provider name', () => {
      expect(() =>
        Schema.decodeUnknownSync(OAuthStrategySchema)({ type: 'oauth', providers: ['unknown'] })
      ).toThrow()
    })
  })
})

describe('AuthStrategySchema', () => {
  test('should discriminate emailAndPassword', () => {
    const input = { type: 'emailAndPassword', minPasswordLength: 10 }
    const result = Schema.decodeUnknownSync(AuthStrategySchema)(input)
    expect(result.type).toBe('emailAndPassword')
  })

  test('should discriminate magicLink', () => {
    const input = { type: 'magicLink' }
    const result = Schema.decodeUnknownSync(AuthStrategySchema)(input)
    expect(result.type).toBe('magicLink')
  })

  test('should discriminate oauth', () => {
    const input = { type: 'oauth', providers: ['github'] }
    const result = Schema.decodeUnknownSync(AuthStrategySchema)(input)
    expect(result.type).toBe('oauth')
  })

  test('should reject unknown type', () => {
    expect(() => Schema.decodeUnknownSync(AuthStrategySchema)({ type: 'passkey' })).toThrow()
  })
})

describe('AuthStrategiesSchema', () => {
  describe('valid values', () => {
    test('should accept single strategy', () => {
      const input = [{ type: 'emailAndPassword' }]
      const result = Schema.decodeUnknownSync(AuthStrategiesSchema)(input)
      expect(result).toHaveLength(1)
    })

    test('should accept multiple different strategies', () => {
      const input = [
        { type: 'emailAndPassword' },
        { type: 'magicLink' },
        { type: 'oauth', providers: ['google'] },
      ]
      const result = Schema.decodeUnknownSync(AuthStrategiesSchema)(input)
      expect(result).toHaveLength(3)
    })
  })

  describe('invalid values', () => {
    test('should reject empty array', () => {
      expect(() => Schema.decodeUnknownSync(AuthStrategiesSchema)([])).toThrow()
    })

    test('should reject duplicate strategy types', () => {
      const input = [{ type: 'emailAndPassword' }, { type: 'emailAndPassword' }]
      expect(() => Schema.decodeUnknownSync(AuthStrategiesSchema)(input)).toThrow()
    })

    test('should reject duplicate oauth strategies', () => {
      const input = [
        { type: 'oauth', providers: ['google'] },
        { type: 'oauth', providers: ['github'] },
      ]
      expect(() => Schema.decodeUnknownSync(AuthStrategiesSchema)(input)).toThrow()
    })
  })
})
