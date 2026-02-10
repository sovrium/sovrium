/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthSchema, getEnabledMethods, hasAnyMethodEnabled, isMethodEnabled, type Auth } from '.'

describe('AuthSchema', () => {
  describe('valid configurations', () => {
    test('should accept minimal configuration with single strategy', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(1)
      expect(result.strategies[0]!.type).toBe('emailAndPassword')
    })

    test('should accept multiple strategies', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }, { type: 'magicLink' as const }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(2)
    })

    test('should accept strategy with config options', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const, minPasswordLength: 12 }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies[0]!.type).toBe('emailAndPassword')
    })

    test('should accept emailAndPassword with requireEmailVerification', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const, requireEmailVerification: true }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies[0]!.type).toBe('emailAndPassword')
    })

    test('should accept OAuth strategy with providers', () => {
      const input = {
        strategies: [
          { type: 'emailAndPassword' as const },
          { type: 'oauth' as const, providers: ['google', 'github'] },
        ],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(2)
      const oauth = result.strategies.find((s) => s.type === 'oauth')
      expect(oauth).toBeDefined()
      if (oauth?.type === 'oauth') {
        expect(oauth.providers).toEqual(['google', 'github'])
      }
    })

    test('should accept OAuth as the only strategy', () => {
      const input = {
        strategies: [{ type: 'oauth' as const, providers: ['google', 'github'] }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(1)
      expect(result.strategies[0]!.type).toBe('oauth')
    })

    test('should accept magicLink strategy with expirationMinutes', () => {
      const input = {
        strategies: [{ type: 'magicLink' as const, expirationMinutes: 30 }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies[0]!.type).toBe('magicLink')
    })

    test('should accept configuration with defaultRole', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
        defaultRole: 'viewer',
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.defaultRole).toBe('viewer')
    })

    test('should accept configuration with custom roles', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
        roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.roles).toHaveLength(1)
    })

    test('should accept enterprise configuration with all strategies', () => {
      const input = {
        strategies: [
          { type: 'emailAndPassword' as const },
          { type: 'magicLink' as const },
          { type: 'oauth' as const, providers: ['google', 'github'] },
        ],
        twoFactor: true,
        roles: [{ name: 'editor', level: 30 }],
        defaultRole: 'member',
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(3)
      expect(result.twoFactor).toBe(true)
    })

    test('should accept email templates configuration', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
        emailTemplates: {
          verification: {
            subject: 'Verify your email',
            text: 'Click to verify: $url',
          },
          resetPassword: {
            subject: 'Reset your password',
            text: 'Click the link to reset your password: $url',
          },
          magicLink: {
            subject: 'Sign in to MyApp',
            text: 'Click to sign in: $url',
            html: '<p>Click <a href="$url">here</a> to sign in.</p>',
          },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.emailTemplates?.verification?.subject).toBe('Verify your email')
      expect(result.emailTemplates?.resetPassword?.text).toBe(
        'Click the link to reset your password: $url'
      )
      expect(result.emailTemplates?.magicLink?.html).toContain('$url')
    })
  })

  describe('invalid configurations', () => {
    test('should reject empty object (missing strategies)', () => {
      const input = {}
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject config with empty strategies array', () => {
      const input = {
        strategies: [],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject duplicate strategy types', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }, { type: 'emailAndPassword' as const }],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.strategies).toHaveLength(1)
      expect(result).not.toHaveProperty('unknownField')
    })
  })

  describe('validation rules', () => {
    test('should reject two-factor without emailAndPassword', () => {
      const input = {
        strategies: [{ type: 'magicLink' as const }],
        twoFactor: true,
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires emailAndPassword strategy'
      )
    })

    test('should reject two-factor with only oauth', () => {
      const input = {
        strategies: [{ type: 'oauth' as const, providers: ['google'] }],
        twoFactor: true,
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires emailAndPassword strategy'
      )
    })

    test('should accept two-factor with emailAndPassword', () => {
      const input = {
        strategies: [{ type: 'emailAndPassword' as const }],
        twoFactor: true,
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.twoFactor).toBe(true)
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
        expect(description.value).toContain('Authentication configuration')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value.length).toBeGreaterThan(0)
        // First example should be minimal config with strategies array
        expect(examples.value[0]).toEqual({
          strategies: [{ type: 'emailAndPassword' }],
        })
      }
    })
  })
})

describe('isMethodEnabled', () => {
  test('should return true for emailAndPassword strategy', () => {
    const auth: Auth = { strategies: [{ type: 'emailAndPassword' }] }
    expect(isMethodEnabled(auth, 'emailAndPassword')).toBe(true)
  })

  test('should return true for magicLink strategy', () => {
    const auth: Auth = { strategies: [{ type: 'magicLink' }] }
    expect(isMethodEnabled(auth, 'magicLink')).toBe(true)
  })

  test('should return true for oauth strategy with providers', () => {
    const auth: Auth = {
      strategies: [{ type: 'oauth', providers: ['google'] }],
    }
    expect(isMethodEnabled(auth, 'oauth')).toBe(true)
  })

  test('should return true for strategy with config object', () => {
    const auth: Auth = {
      strategies: [{ type: 'emailAndPassword', minPasswordLength: 12 }],
    }
    expect(isMethodEnabled(auth, 'emailAndPassword')).toBe(true)
  })

  test('should return false for absent strategy', () => {
    const auth: Auth = { strategies: [{ type: 'emailAndPassword' }] }
    expect(isMethodEnabled(auth, 'magicLink')).toBe(false)
  })

  test('should return false for undefined config', () => {
    expect(isMethodEnabled(undefined, 'emailAndPassword')).toBe(false)
  })
})

describe('getEnabledMethods', () => {
  test('should return all enabled strategies', () => {
    const auth: Auth = {
      strategies: [{ type: 'emailAndPassword' }, { type: 'magicLink' }],
    }
    const enabled = getEnabledMethods(auth)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toContain('magicLink')
    expect(enabled).toHaveLength(2)
  })

  test('should include oauth when configured', () => {
    const auth: Auth = {
      strategies: [{ type: 'emailAndPassword' }, { type: 'oauth', providers: ['google'] }],
    }
    const enabled = getEnabledMethods(auth)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toContain('oauth')
    expect(enabled).toHaveLength(2)
  })

  test('should include strategies with config objects', () => {
    const auth: Auth = {
      strategies: [{ type: 'emailAndPassword', requireEmailVerification: true }],
    }
    const enabled = getEnabledMethods(auth)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toHaveLength(1)
  })

  test('should return empty array for undefined', () => {
    expect(getEnabledMethods(undefined)).toEqual([])
  })
})

describe('hasAnyMethodEnabled', () => {
  test('should return true when at least one strategy is defined', () => {
    const emailAuth: Auth = { strategies: [{ type: 'emailAndPassword' }] }
    const magicAuth: Auth = { strategies: [{ type: 'magicLink' }] }
    const oauthAuth: Auth = { strategies: [{ type: 'oauth', providers: ['google'] }] }
    expect(hasAnyMethodEnabled(emailAuth)).toBe(true)
    expect(hasAnyMethodEnabled(magicAuth)).toBe(true)
    expect(hasAnyMethodEnabled(oauthAuth)).toBe(true)
  })

  test('should return false when no strategies defined', () => {
    expect(hasAnyMethodEnabled({ strategies: [] } as any)).toBe(false)
  })

  test('should return false for undefined', () => {
    expect(hasAnyMethodEnabled(undefined)).toBe(false)
  })
})
