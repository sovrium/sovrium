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
        methods: { emailAndPassword: true },
        plugins: { admin: true, organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        plugins: { admin: true, organization: true },
      })
    })

    test('should accept auth with only authentication method', () => {
      const input = {
        methods: { emailAndPassword: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
      })
    })

    test('should accept auth with admin plugin only', () => {
      const input = {
        methods: { emailAndPassword: true },
        plugins: { admin: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        plugins: { admin: true },
      })
    })

    test('should accept auth with organization plugin only', () => {
      const input = {
        methods: { emailAndPassword: true },
        plugins: { organization: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        plugins: { organization: true },
      })
    })

    test('should accept auth with empty plugins object', () => {
      const input = {
        methods: { emailAndPassword: true },
        plugins: {},
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        plugins: {},
      })
    })

    test('should accept plugin with config object', () => {
      const input = {
        methods: { emailAndPassword: true },
        plugins: { admin: { impersonation: true } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        plugins: { admin: { impersonation: true } },
      })
    })

    test('should accept OAuth configuration', () => {
      const input = {
        methods: { emailAndPassword: true },
        oauth: { providers: ['google', 'github'] },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true },
        oauth: { providers: ['google', 'github'] },
      })
    })

    test('should accept multiple authentication methods', () => {
      const input = {
        methods: { emailAndPassword: true, magicLink: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: true, magicLink: true },
      })
    })

    test('should accept authentication method with config', () => {
      const input = {
        methods: { emailAndPassword: { minPasswordLength: 12 } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: { minPasswordLength: 12 } },
      })
    })

    test('should accept emailAndPassword with requireEmailVerification', () => {
      const input = {
        methods: { emailAndPassword: { requireEmailVerification: true } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({
        methods: { emailAndPassword: { requireEmailVerification: true } },
      })
    })

    test('should accept enterprise configuration', () => {
      const input = {
        methods: { emailAndPassword: true, passkey: true },
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
        methods: { emailAndPassword: true },
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
        methods: { magicLink: { expirationMinutes: 30 } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.methods.magicLink).toEqual({ expirationMinutes: 30 })
    })

    test('should accept passkey with configuration', () => {
      const input = {
        methods: { passkey: { userVerification: 'required', rpName: 'My App' } },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.methods.passkey).toEqual({ userVerification: 'required', rpName: 'My App' })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing methods field', () => {
      const input = {
        plugins: { admin: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject empty methods object (no method enabled)', () => {
      const input = {
        methods: {},
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'At least one authentication method must be enabled'
      )
    })

    test('should reject methods as array (old format)', () => {
      const input = {
        methods: ['email-and-password'],
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should reject methods as string', () => {
      const input = {
        methods: 'emailAndPassword',
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow()
    })

    test('should strip unknown top-level fields (Effect Schema default behavior)', () => {
      const input = {
        methods: { emailAndPassword: true },
        unknownField: 'value',
      }
      // Effect Schema strips unknown fields by default (lenient mode)
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result).toEqual({ methods: { emailAndPassword: true } })
      expect(result).not.toHaveProperty('unknownField')
    })
  })

  describe('validation rules', () => {
    test('should reject two-factor without primary auth method', () => {
      const input = {
        methods: { magicLink: true },
        plugins: { twoFactor: true },
      }
      expect(() => Schema.decodeUnknownSync(AuthSchema)(input)).toThrow(
        'Two-factor authentication requires emailAndPassword or passkey authentication'
      )
    })

    test('should accept two-factor with emailAndPassword', () => {
      const input = {
        methods: { emailAndPassword: true },
        plugins: { twoFactor: true },
      }
      const result = Schema.decodeUnknownSync(AuthSchema)(input)
      expect(result.plugins?.twoFactor).toBe(true)
    })

    test('should accept two-factor with passkey', () => {
      const input = {
        methods: { passkey: true },
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
        // First example should be minimal config with object-based methods
        expect(examples.value[0]).toEqual({
          methods: { emailAndPassword: true },
        })
      }
    })
  })
})
