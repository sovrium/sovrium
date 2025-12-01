/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { AuthSchema } from '.'

describe('AuthSchema', () => {
  describe('valid configurations', () => {
    test('should accept full auth configuration with all plugins', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: { admin: true, organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        plugins: { admin: true, organization: true },
      })
    })

    test('should accept auth with only authentication method', () => {
      const input = {
        authentication: ['email-and-password'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
      })
    })

    test('should accept auth with admin plugin only', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: { admin: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        plugins: { admin: true },
      })
    })

    test('should accept auth with organization plugin only', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: { organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        plugins: { organization: true },
      })
    })

    test('should accept auth with empty plugins object', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: {},
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        plugins: {},
      })
    })

    test('should accept plugin with config object', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: { admin: { impersonation: true } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        plugins: { admin: { impersonation: true } },
      })
    })

    test('should accept OAuth configuration', () => {
      const input = {
        authentication: ['email-and-password'],
        oauth: { providers: ['google', 'github'] },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password'],
        oauth: { providers: ['google', 'github'] },
      })
    })

    test('should accept multiple authentication methods', () => {
      const input = {
        authentication: ['email-and-password', 'magic-link'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: ['email-and-password', 'magic-link'],
      })
    })

    test('should accept authentication method with config', () => {
      const input = {
        authentication: [{ method: 'email-and-password', minPasswordLength: 12 }],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        authentication: [{ method: 'email-and-password', minPasswordLength: 12 }],
      })
    })

    test('should accept secret env var reference', () => {
      const input = {
        secret: '$BETTER_AUTH_SECRET',
        authentication: ['email-and-password'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.secret).toBe('$BETTER_AUTH_SECRET')
    })

    test('should accept baseURL', () => {
      const input = {
        baseURL: 'https://myapp.com',
        authentication: ['email-and-password'],
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.baseURL).toBe('https://myapp.com')
    })

    test('should accept admin plugin with defaultAdmin', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: {
          admin: {
            impersonation: true,
            defaultAdmin: {
              email: 'admin@myapp.com',
              password: '$ADMIN_PASSWORD',
              name: 'Admin User',
            },
          },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.plugins?.admin).toEqual({
        impersonation: true,
        defaultAdmin: {
          email: 'admin@myapp.com',
          password: '$ADMIN_PASSWORD',
          name: 'Admin User',
        },
      })
    })

    test('should accept full enterprise configuration', () => {
      const input = {
        secret: '$BETTER_AUTH_SECRET',
        baseURL: 'https://myapp.com',
        authentication: ['email-and-password', 'passkey'],
        oauth: { providers: ['google', 'github'] },
        plugins: {
          admin: {
            impersonation: true,
            defaultAdmin: { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD' },
          },
          organization: { maxMembersPerOrg: 50 },
        },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.secret).toBe('$BETTER_AUTH_SECRET')
      expect(result.baseURL).toBe('https://myapp.com')
      expect(result.oauth?.providers).toEqual(['google', 'github'])
    })

    test('should accept email templates configuration', () => {
      const input = {
        authentication: ['email-and-password'],
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
    test('should reject missing authentication field', () => {
      const input = {
        plugins: { admin: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject empty authentication array', () => {
      const input = {
        authentication: [],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject invalid authentication method', () => {
      const input = {
        authentication: ['unknown-method'],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject authentication as string', () => {
      const input = {
        authentication: 'email-and-password',
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        authentication: ['email-and-password'],
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({ authentication: ['email-and-password'] })
      expect(result).not.toHaveProperty('unknownField')
    })
  })

  describe('validation rules', () => {
    test('should reject two-factor without primary auth method', () => {
      const input = {
        authentication: ['magic-link'],
        plugins: { twoFactor: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires email-and-password or passkey authentication'
      )
    })

    test('should accept two-factor with email-and-password', () => {
      const input = {
        authentication: ['email-and-password'],
        plugins: { twoFactor: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.plugins?.twoFactor).toBe(true)
    })

    test('should accept two-factor with passkey', () => {
      const input = {
        authentication: ['passkey'],
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
        expect(description.value).toBe(
          'Comprehensive authentication configuration with methods, OAuth, plugins, and email templates. Email transport configuration is handled at the app level.'
        )
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(AuthSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value.length).toBeGreaterThan(0)
        // First example should be minimal config
        expect(examples.value[0]).toEqual({
          authentication: ['email-and-password'],
        })
      }
    })
  })
})
