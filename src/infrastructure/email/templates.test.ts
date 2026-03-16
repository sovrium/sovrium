/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import {
  passwordResetEmail,
  emailVerificationEmail,
  type PasswordResetEmailData,
  type EmailVerificationData,
} from './templates'

describe('passwordResetEmail', () => {
  test('generates subject line', () => {
    const data: PasswordResetEmailData = {
      userName: 'Alice',
      resetUrl: 'https://sovrium.com/reset?token=abc123',
      expiresIn: '30 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email.subject).toBe('Reset your Sovrium password')
  })

  test('generates HTML content with user name', () => {
    const data: PasswordResetEmailData = {
      userName: 'Alice',
      resetUrl: 'https://sovrium.com/reset?token=abc123',
      expiresIn: '30 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email.html).toContain('Hi Alice')
    expect(email.html).toContain('https://sovrium.com/reset?token=abc123')
    expect(email.html).toContain('30 minutes')
  })

  test('generates plain text content with user name', () => {
    const data: PasswordResetEmailData = {
      userName: 'Alice',
      resetUrl: 'https://sovrium.com/reset?token=abc123',
      expiresIn: '30 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email.text).toContain('Hi Alice')
    expect(email.text).toContain('https://sovrium.com/reset?token=abc123')
    expect(email.text).toContain('30 minutes')
  })

  test('uses default greeting when userName is undefined', () => {
    const data: PasswordResetEmailData = {
      resetUrl: 'https://sovrium.com/reset?token=abc123',
      expiresIn: '30 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email.html).toContain('Hi,')
    expect(email.text).toContain('Hi,')
  })

  test('uses default expiry when expiresIn is undefined', () => {
    const data: PasswordResetEmailData = {
      userName: 'Bob',
      resetUrl: 'https://sovrium.com/reset?token=xyz789',
    }

    const email = passwordResetEmail(data)

    expect(email.html).toContain('1 hour')
    expect(email.text).toContain('1 hour')
  })

  test('includes security warning about unsolicited request', () => {
    const data: PasswordResetEmailData = {
      userName: 'Bob',
      resetUrl: 'https://sovrium.com/reset?token=xyz789',
      expiresIn: '15 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email.html).toContain("didn't request")
    expect(email.html).toContain('safely ignore')
    expect(email.text).toContain("didn't request")
    expect(email.text).toContain('safely ignore')
  })

  test('includes expiry time in content', () => {
    const data: PasswordResetEmailData = {
      userName: 'Charlie',
      resetUrl: 'https://sovrium.com/reset?token=def456',
      expiresIn: '1 hour',
    }

    const email = passwordResetEmail(data)

    expect(email.html).toContain('1 hour')
    expect(email.text).toContain('1 hour')
  })
})

describe('emailVerificationEmail', () => {
  test('generates subject line', () => {
    const data: EmailVerificationData = {
      userName: 'Alice',
      verifyUrl: 'https://sovrium.com/verify?token=abc123',
    }

    const email = emailVerificationEmail(data)

    expect(email.subject).toBe('Verify your Sovrium email address')
  })

  test('generates HTML content with user name', () => {
    const data: EmailVerificationData = {
      userName: 'Alice',
      verifyUrl: 'https://sovrium.com/verify?token=abc123',
    }

    const email = emailVerificationEmail(data)

    expect(email.html).toContain('Hi Alice')
    expect(email.html).toContain('https://sovrium.com/verify?token=abc123')
  })

  test('generates plain text content with user name', () => {
    const data: EmailVerificationData = {
      userName: 'Alice',
      verifyUrl: 'https://sovrium.com/verify?token=abc123',
    }

    const email = emailVerificationEmail(data)

    expect(email.text).toContain('Hi Alice')
    expect(email.text).toContain('https://sovrium.com/verify?token=abc123')
  })

  test('uses default greeting when userName is undefined', () => {
    const data: EmailVerificationData = {
      userName: undefined,
      verifyUrl: 'https://sovrium.com/verify?token=abc123',
    }

    const email = emailVerificationEmail(data)

    expect(email.html).toContain('Hi,')
    expect(email.text).toContain('Hi,')
  })

  test('uses default expiry when expiresIn is undefined', () => {
    const data: EmailVerificationData = {
      userName: 'Bob',
      verifyUrl: 'https://sovrium.com/verify?token=xyz789',
    }

    const email = emailVerificationEmail(data)

    expect(email.html).toContain('24 hours')
    expect(email.text).toContain('24 hours')
  })

  test('includes call to action for verification', () => {
    const data: EmailVerificationData = {
      userName: 'Bob',
      verifyUrl: 'https://sovrium.com/verify?token=xyz789',
    }

    const email = emailVerificationEmail(data)

    expect(email.html).toContain('Verify')
    expect(email.text).toContain('verify')
  })

  test('includes security note about account creation', () => {
    const data: EmailVerificationData = {
      userName: 'Charlie',
      verifyUrl: 'https://sovrium.com/verify?token=def456',
    }

    const email = emailVerificationEmail(data)

    expect(email.html).toContain("didn't create")
    expect(email.text).toContain("didn't create")
  })
})

describe('email template structure', () => {
  test('passwordResetEmail returns object with subject, html, and text', () => {
    const data: PasswordResetEmailData = {
      userName: 'Test',
      resetUrl: 'https://test.com',
      expiresIn: '30 minutes',
    }

    const email = passwordResetEmail(data)

    expect(email).toHaveProperty('subject')
    expect(email).toHaveProperty('html')
    expect(email).toHaveProperty('text')
    expect(typeof email.subject).toBe('string')
    expect(typeof email.html).toBe('string')
    expect(typeof email.text).toBe('string')
  })

  test('emailVerificationEmail returns object with subject, html, and text', () => {
    const data: EmailVerificationData = {
      userName: 'Test',
      verifyUrl: 'https://test.com',
    }

    const email = emailVerificationEmail(data)

    expect(email).toHaveProperty('subject')
    expect(email).toHaveProperty('html')
    expect(email).toHaveProperty('text')
    expect(typeof email.subject).toBe('string')
    expect(typeof email.html).toBe('string')
    expect(typeof email.text).toBe('string')
  })
})
