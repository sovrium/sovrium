/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthSchema, getEnabledMethods, hasAnyMethodEnabled, isMethodEnabled } from '.'

describe('AuthSchema', () => {
  describe('valid configurations', () => {
    test('should accept full auth configuration with all plugins', () => {
      const input = {
        emailAndPassword: true,
        plugins: { admin: true, organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        plugins: { admin: true, organization: true },
      })
    })

    test('should accept auth with only authentication method', () => {
      const input = {
        emailAndPassword: true,
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
      })
    })

    test('should accept auth with admin plugin only', () => {
      const input = {
        emailAndPassword: true,
        plugins: { admin: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        plugins: { admin: true },
      })
    })

    test('should accept auth with organization plugin only', () => {
      const input = {
        emailAndPassword: true,
        plugins: { organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        plugins: { organization: true },
      })
    })

    test('should accept auth with empty plugins object', () => {
      const input = {
        emailAndPassword: true,
        plugins: {},
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        plugins: {},
      })
    })

    test('should accept plugin with config object', () => {
      const input = {
        emailAndPassword: true,
        plugins: { admin: { impersonation: true } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        plugins: { admin: { impersonation: true } },
      })
    })

    test('should accept OAuth configuration as peer method', () => {
      const input = {
        emailAndPassword: true,
        oauth: { providers: ['google', 'github'] },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        oauth: { providers: ['google', 'github'] },
      })
    })

    test('should accept OAuth as the only authentication method', () => {
      const input = {
        oauth: { providers: ['google', 'github'] },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        oauth: { providers: ['google', 'github'] },
      })
    })

    test('should accept multiple authentication methods', () => {
      const input = {
        emailAndPassword: true,
        magicLink: true,
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: true,
        magicLink: true,
      })
    })

    test('should accept authentication method with config', () => {
      const input = {
        emailAndPassword: { minPasswordLength: 12 },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: { minPasswordLength: 12 },
      })
    })

    test('should accept emailAndPassword with requireEmailVerification', () => {
      const input = {
        emailAndPassword: { requireEmailVerification: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        emailAndPassword: { requireEmailVerification: true },
      })
    })

    test('should accept enterprise configuration', () => {
      const input = {
        emailAndPassword: true,
        magicLink: true,
        oauth: { providers: ['google', 'github'] },
        plugins: {
          admin: { impersonation: true },
          organization: { maxMembersPerOrg: 50 },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.oauth?.providers).toEqual(['google', 'github'])
    })

    test('should accept email templates configuration', () => {
      const input = {
        emailAndPassword: true,
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

    test('should accept magicLink with expirationMinutes', () => {
      const input = {
        magicLink: { expirationMinutes: 30 },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.magicLink).toEqual({ expirationMinutes: 30 })
    })
  })

  describe('invalid configurations', () => {
    test('should reject empty object (no method enabled)', () => {
      const input = {}
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'At least one authentication method must be enabled'
      )
    })

    test('should reject config with only plugins (no method enabled)', () => {
      const input = {
        plugins: { admin: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'At least one authentication method must be enabled'
      )
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        emailAndPassword: true,
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({ emailAndPassword: true })
      expect(result).not.toHaveProperty('unknownField')
    })
  })

  describe('validation rules', () => {
    test('should reject two-factor without emailAndPassword', () => {
      const input = {
        magicLink: true,
        plugins: { twoFactor: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires emailAndPassword authentication'
      )
    })

    test('should reject two-factor with only oauth', () => {
      const input = {
        oauth: { providers: ['google'] },
        plugins: { twoFactor: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires emailAndPassword authentication'
      )
    })

    test('should accept two-factor with emailAndPassword', () => {
      const input = {
        emailAndPassword: true,
        plugins: { twoFactor: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.plugins?.twoFactor).toBe(true)
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
        // First example should be minimal config with flat structure
        expect(examples.value[0]).toEqual({
          emailAndPassword: true,
        })
      }
    })
  })
})

describe('isMethodEnabled', () => {
  test('should return true for boolean true', () => {
    expect(isMethodEnabled({ emailAndPassword: true }, 'emailAndPassword')).toBe(true)
    expect(isMethodEnabled({ magicLink: true }, 'magicLink')).toBe(true)
  })

  test('should return true for oauth with providers', () => {
    expect(isMethodEnabled({ oauth: { providers: ['google'] } }, 'oauth')).toBe(true)
  })

  test('should return true for config object', () => {
    expect(
      isMethodEnabled({ emailAndPassword: { minPasswordLength: 12 } }, 'emailAndPassword')
    ).toBe(true)
  })

  test('should return false for undefined method', () => {
    expect(isMethodEnabled({ emailAndPassword: true }, 'magicLink')).toBe(false)
  })

  test('should return false for undefined config', () => {
    expect(isMethodEnabled(undefined, 'emailAndPassword')).toBe(false)
  })
})

describe('getEnabledMethods', () => {
  test('should return all enabled methods', () => {
    const config = { emailAndPassword: true, magicLink: true }
    const enabled = getEnabledMethods(config)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toContain('magicLink')
    expect(enabled).toHaveLength(2)
  })

  test('should include oauth when configured', () => {
    const config = { emailAndPassword: true, oauth: { providers: ['google'] as const } }
    const enabled = getEnabledMethods(config)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toContain('oauth')
    expect(enabled).toHaveLength(2)
  })

  test('should include methods with config objects', () => {
    const config = { emailAndPassword: { requireEmailVerification: true } }
    const enabled = getEnabledMethods(config)
    expect(enabled).toContain('emailAndPassword')
    expect(enabled).toHaveLength(1)
  })

  test('should return empty array for undefined', () => {
    expect(getEnabledMethods(undefined)).toEqual([])
  })
})

describe('hasAnyMethodEnabled', () => {
  test('should return true when at least one method is enabled', () => {
    expect(hasAnyMethodEnabled({ emailAndPassword: true })).toBe(true)
    expect(hasAnyMethodEnabled({ magicLink: true })).toBe(true)
    expect(hasAnyMethodEnabled({ oauth: { providers: ['google'] as const } })).toBe(true)
  })

  test('should return false when no methods are enabled', () => {
    expect(hasAnyMethodEnabled({})).toBe(false)
  })

  test('should return false for undefined', () => {
    expect(hasAnyMethodEnabled(undefined)).toBe(false)
  })
})
