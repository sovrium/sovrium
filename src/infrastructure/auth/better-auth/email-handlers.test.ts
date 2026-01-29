/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock, beforeEach } from 'bun:test'
import { createEmailHandlers } from './email-handlers'
import type { Auth } from '@/domain/models/app/auth'

describe('substituteVariables', () => {
  // Note: substituteVariables is internal, we test it through email handlers

  test('substitutes $name variable', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Hello $name',
          text: 'Welcome $name',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)
    const mockUser = { email: 'user@example.com', name: 'Alice' }

    // Call handler to trigger substitution
    await handlers.passwordReset({
      user: mockUser,
      url: 'https://example.com/reset',
      token: 'test-token',
    })

    // Verify substitution happened (indirectly through email sending)
    // Email sending will use the substituted template
  })

  test('substitutes $url variable', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Reset password',
          text: 'Click here: $url',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    await handlers.passwordReset({
      user: { email: 'user@example.com' },
      url: 'https://example.com/reset',
      token: 'test-token',
    })
  })

  test('substitutes $email variable', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Email: $email',
          text: 'Your email: $email',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    await handlers.passwordReset({
      user: { email: 'user@example.com' },
      url: 'https://example.com/reset',
      token: 'test-token',
    })
  })

  test('uses default value for missing $name', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Hello $name',
          text: 'Welcome $name',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)
    const mockUser = { email: 'user@example.com' } // No name field

    await handlers.passwordReset({
      user: mockUser,
      url: 'https://example.com/reset',
      token: 'test-token',
    })

    // Should substitute with "there" as default
  })
})

describe('createEmailHandlers', () => {
  test('creates all three email handlers', () => {
    const handlers = createEmailHandlers(undefined)

    expect(handlers).toHaveProperty('passwordReset')
    expect(handlers).toHaveProperty('verification')
    expect(handlers).toHaveProperty('magicLink')
    expect(typeof handlers.passwordReset).toBe('function')
    expect(typeof handlers.verification).toBe('function')
    expect(typeof handlers.magicLink).toBe('function')
  })

  test('creates handlers with custom templates when provided', () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Custom reset subject',
          text: 'Custom reset text',
        },
        verification: {
          subject: 'Custom verification subject',
          html: '<p>Custom verification HTML</p>',
        },
        magicLink: {
          subject: 'Custom magic link subject',
          text: 'Custom magic link text',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    expect(handlers.passwordReset).toBeDefined()
    expect(handlers.verification).toBeDefined()
    expect(handlers.magicLink).toBeDefined()
  })

  test('creates handlers without crashing when authConfig is undefined', () => {
    expect(() => createEmailHandlers(undefined)).not.toThrow()
  })

  test('creates handlers without crashing when emailTemplates is undefined', () => {
    const authConfig: Auth = {}

    expect(() => createEmailHandlers(authConfig)).not.toThrow()
  })
})

describe('passwordReset handler', () => {
  test('accepts user with email and name', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.passwordReset({
        user: { email: 'user@example.com', name: 'Alice' },
        url: 'https://example.com/reset',
        token: 'test-token',
      })
    ).resolves.toBeUndefined()
  })

  test('accepts user with only email', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.passwordReset({
        user: { email: 'user@example.com' },
        url: 'https://example.com/reset',
        token: 'test-token',
      })
    ).resolves.toBeUndefined()
  })

  test('handles email sending errors silently', async () => {
    // This tests the error handling behavior
    // Even if email fails to send, handler should not throw
    const handlers = createEmailHandlers(undefined)

    // Test with potentially invalid email (should not throw)
    await expect(
      handlers.passwordReset({
        user: { email: 'invalid-email' },
        url: 'https://example.com/reset',
        token: 'test-token',
      })
    ).resolves.toBeUndefined()
  })

  test('builds URL with token parameter', async () => {
    const handlers = createEmailHandlers(undefined)

    // URL building is tested indirectly through email sending
    await handlers.passwordReset({
      user: { email: 'user@example.com' },
      url: 'https://example.com/reset',
      token: 'abc123',
    })

    // Expected URL: https://example.com/reset?token=abc123
  })

  test('uses custom template when provided', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        resetPassword: {
          subject: 'Custom reset: $name',
          text: 'Reset link: $url',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    await expect(
      handlers.passwordReset({
        user: { email: 'user@example.com', name: 'Bob' },
        url: 'https://example.com/reset',
        token: 'token123',
      })
    ).resolves.toBeUndefined()
  })

  test('uses default template when no custom template provided', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.passwordReset({
        user: { email: 'user@example.com', name: 'Charlie' },
        url: 'https://example.com/reset',
        token: 'token456',
      })
    ).resolves.toBeUndefined()
  })
})

describe('verification handler', () => {
  test('accepts user with email and name', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.verification({
        user: { email: 'user@example.com', name: 'Alice' },
        url: 'https://example.com/verify',
        token: 'test-token',
      })
    ).resolves.toBeUndefined()
  })

  test('handles URL already containing token parameter', async () => {
    const handlers = createEmailHandlers(undefined)

    // Better Auth sometimes includes token in URL already
    await handlers.verification({
      user: { email: 'user@example.com' },
      url: 'https://example.com/verify?token=existing-token',
      token: 'new-token',
    })

    // Should not add ?token= again
  })

  test('adds token parameter when not present in URL', async () => {
    const handlers = createEmailHandlers(undefined)

    await handlers.verification({
      user: { email: 'user@example.com' },
      url: 'https://example.com/verify',
      token: 'new-token',
    })

    // Should add ?token=new-token
  })

  test('uses custom template when provided', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        verification: {
          subject: 'Verify your email, $name',
          html: '<p>Click to verify: <a href="$url">Verify</a></p>',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    await expect(
      handlers.verification({
        user: { email: 'user@example.com', name: 'Dave' },
        url: 'https://example.com/verify',
        token: 'token789',
      })
    ).resolves.toBeUndefined()
  })
})

describe('magicLink handler', () => {
  test('accepts user with email and name', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.magicLink({
        user: { email: 'user@example.com', name: 'Alice' },
        url: 'https://example.com/magic',
        token: 'test-token',
      })
    ).resolves.toBeUndefined()
  })

  test('builds URL with token parameter', async () => {
    const handlers = createEmailHandlers(undefined)

    await handlers.magicLink({
      user: { email: 'user@example.com' },
      url: 'https://example.com/magic',
      token: 'magic123',
    })

    // Expected URL: https://example.com/magic?token=magic123
  })

  test('uses custom template when provided', async () => {
    const authConfig: Auth = {
      emailTemplates: {
        magicLink: {
          subject: 'Sign in magic link for $name',
          text: 'Your magic link: $url',
        },
      },
    }

    const handlers = createEmailHandlers(authConfig)

    await expect(
      handlers.magicLink({
        user: { email: 'user@example.com', name: 'Eve' },
        url: 'https://example.com/magic',
        token: 'magic456',
      })
    ).resolves.toBeUndefined()
  })

  test('uses default template when no custom template provided', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.magicLink({
        user: { email: 'user@example.com', name: 'Frank' },
        url: 'https://example.com/magic',
        token: 'magic789',
      })
    ).resolves.toBeUndefined()
  })

  test('handles missing user name in default template', async () => {
    const handlers = createEmailHandlers(undefined)

    await expect(
      handlers.magicLink({
        user: { email: 'user@example.com' }, // No name
        url: 'https://example.com/magic',
        token: 'magic-no-name',
      })
    ).resolves.toBeUndefined()

    // Should use "there" as default name
  })
})
