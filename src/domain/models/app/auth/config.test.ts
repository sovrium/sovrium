/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { AuthEmailTemplateSchema, AuthEmailTemplatesSchema } from './config'

describe('AuthEmailTemplateSchema', () => {
  test('should accept subject only', () => {
    const input = { subject: 'Welcome to MyApp' }
    const result = Schema.decodeUnknownSync(AuthEmailTemplateSchema)(input)
    expect(result.subject).toBe('Welcome to MyApp')
    expect(result.text).toBeUndefined()
    expect(result.html).toBeUndefined()
  })

  test('should accept subject with text body', () => {
    const input = {
      subject: 'Verify your email',
      text: 'Click the link to verify: $url',
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplateSchema)(input)
    expect(result.subject).toBe('Verify your email')
    expect(result.text).toBe('Click the link to verify: $url')
  })

  test('should accept subject with html body', () => {
    const input = {
      subject: 'Reset your password',
      html: '<p>Click <a href="$url">here</a> to reset your password.</p>',
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplateSchema)(input)
    expect(result.subject).toBe('Reset your password')
    expect(result.html).toBe('<p>Click <a href="$url">here</a> to reset your password.</p>')
  })

  test('should accept subject with both text and html', () => {
    const input = {
      subject: 'Magic link login',
      text: 'Click to sign in: $url',
      html: '<p>Click <a href="$url">here</a> to sign in.</p>',
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplateSchema)(input)
    expect(result.subject).toBe('Magic link login')
    expect(result.text).toBe('Click to sign in: $url')
    expect(result.html).toBe('<p>Click <a href="$url">here</a> to sign in.</p>')
  })

  test('should accept template with variable substitution syntax', () => {
    const input = {
      subject: 'Welcome, $name!',
      text: 'Hi $name, your email is $email. Verify here: $url',
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplateSchema)(input)
    expect(result.subject).toBe('Welcome, $name!')
    expect(result.text).toBe('Hi $name, your email is $email. Verify here: $url')
  })

  test('should reject missing subject', () => {
    expect(() => Schema.decodeUnknownSync(AuthEmailTemplateSchema)({ text: 'Hello' })).toThrow()
  })
})

describe('AuthEmailTemplatesSchema', () => {
  test('should accept empty object', () => {
    const result = Schema.decodeUnknownSync(AuthEmailTemplatesSchema)({})
    expect(result).toEqual({})
  })

  test('should accept single template', () => {
    const input = {
      verification: { subject: 'Verify your email', text: 'Click here: $url' },
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplatesSchema)(input)
    expect(result.verification?.subject).toBe('Verify your email')
    expect(result.verification?.text).toBe('Click here: $url')
  })

  test('should accept multiple templates', () => {
    const input = {
      verification: { subject: 'Verify your email', text: 'Click to verify: $url' },
      resetPassword: { subject: 'Reset your password', text: 'Click to reset: $url' },
      magicLink: { subject: 'Sign in to MyApp', text: 'Click to sign in: $url' },
      welcome: { subject: 'Welcome!', text: 'Welcome to MyApp, $name!' },
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplatesSchema)(input)
    expect(result.verification?.subject).toBe('Verify your email')
    expect(result.resetPassword?.subject).toBe('Reset your password')
    expect(result.magicLink?.subject).toBe('Sign in to MyApp')
    expect(result.welcome?.subject).toBe('Welcome!')
  })

  test('should accept all template types', () => {
    const input = {
      verification: { subject: 'Verify' },
      resetPassword: { subject: 'Reset' },
      magicLink: { subject: 'Magic Link' },
      emailOtp: { subject: 'Your code: $code' },
      organizationInvitation: { subject: 'Join $organizationName' },
      twoFactorBackupCodes: { subject: 'Your backup codes' },
      welcome: { subject: 'Welcome!' },
      accountDeletion: { subject: 'Account deleted' },
    }
    const result = Schema.decodeUnknownSync(AuthEmailTemplatesSchema)(input)
    expect(result.verification?.subject).toBe('Verify')
    expect(result.resetPassword?.subject).toBe('Reset')
    expect(result.magicLink?.subject).toBe('Magic Link')
    expect(result.emailOtp?.subject).toBe('Your code: $code')
    expect(result.organizationInvitation?.subject).toBe('Join $organizationName')
    expect(result.twoFactorBackupCodes?.subject).toBe('Your backup codes')
    expect(result.welcome?.subject).toBe('Welcome!')
    expect(result.accountDeletion?.subject).toBe('Account deleted')
  })

  test('should reject invalid template (missing subject)', () => {
    expect(() =>
      Schema.decodeUnknownSync(AuthEmailTemplatesSchema)({
        verification: { text: 'Hello' },
      })
    ).toThrow()
  })
})
