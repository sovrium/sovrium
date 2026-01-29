/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test'
import {
  buildSocialProviders,
  buildEmailAndPasswordConfig,
  buildRateLimitConfig,
  buildAuthHooks,
  buildAuthPlugins,
} from './auth'
import type { Auth } from '@/domain/models/app/auth'

describe('buildSocialProviders', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv
  })

  test('returns empty object when authConfig is undefined', () => {
    const result = buildSocialProviders(undefined)
    expect(result).toEqual({})
  })

  test('returns empty object when oauth is not configured', () => {
    const authConfig: Auth = {}
    const result = buildSocialProviders(authConfig)
    expect(result).toEqual({})
  })

  test('returns empty object when oauth.providers is empty', () => {
    const authConfig: Auth = { oauth: { providers: [] as unknown as ['google'] } }
    const result = buildSocialProviders(authConfig)
    expect(result).toEqual({})
  })

  test('maps single provider from environment variables', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret'

    const authConfig: Auth = { oauth: { providers: ['google'] } }
    const result = buildSocialProviders(authConfig)

    expect(result).toEqual({
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-secret',
      },
    })
  })

  test('maps multiple providers from environment variables', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret'
    process.env.GITHUB_CLIENT_ID = 'github-id'
    process.env.GITHUB_CLIENT_SECRET = 'github-secret'

    const authConfig: Auth = { oauth: { providers: ['google', 'github'] } }
    const result = buildSocialProviders(authConfig)

    expect(result).toEqual({
      google: {
        clientId: 'google-id',
        clientSecret: 'google-secret',
      },
      github: {
        clientId: 'github-id',
        clientSecret: 'github-secret',
      },
    })
  })

  test('uses empty string when environment variables are missing', () => {
    const authConfig: Auth = { oauth: { providers: ['google'] } }
    const result = buildSocialProviders(authConfig)

    expect(result).toEqual({
      google: {
        clientId: '',
        clientSecret: '',
      },
    })
  })

  test('handles mixed case provider names correctly', () => {
    process.env.FACEBOOK_CLIENT_ID = 'fb-id'
    process.env.FACEBOOK_CLIENT_SECRET = 'fb-secret'

    const authConfig: Auth = { oauth: { providers: ['facebook' as 'google'] } }
    const result = buildSocialProviders(authConfig)

    expect(result).toEqual({
      facebook: {
        clientId: 'fb-id',
        clientSecret: 'fb-secret',
      },
    })
  })
})

describe('buildEmailAndPasswordConfig', () => {
  const mockHandlers = {
    passwordReset: mock(() => Promise.resolve()),
    verification: mock(() => Promise.resolve()),
    magicLink: mock(() => Promise.resolve()),
  }

  test('uses defaults when authConfig is undefined', () => {
    const result = buildEmailAndPasswordConfig(undefined, mockHandlers)

    expect(result).toEqual({
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: mockHandlers.passwordReset,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    })
  })

  test('uses defaults when emailAndPassword is not configured', () => {
    const authConfig: Auth = {}
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result).toEqual({
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: mockHandlers.passwordReset,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    })
  })

  test('uses defaults when emailAndPassword is boolean true', () => {
    const authConfig: Auth = { emailAndPassword: true }
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result).toEqual({
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: mockHandlers.passwordReset,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    })
  })

  test('enables email verification when configured', () => {
    const authConfig: Auth = {
      emailAndPassword: {
        requireEmailVerification: true,
      },
    }
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result.requireEmailVerification).toBe(true)
  })

  test('disables email verification explicitly when configured', () => {
    const authConfig: Auth = {
      emailAndPassword: {
        requireEmailVerification: false,
      },
    }
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result.requireEmailVerification).toBe(false)
  })

  test('always includes password reset handler', () => {
    const authConfig: Auth = {}
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result.sendResetPassword).toBe(mockHandlers.passwordReset)
  })

  test('always sets standard password length constraints', () => {
    const authConfig: Auth = {
      emailAndPassword: {
        requireEmailVerification: true,
      },
    }
    const result = buildEmailAndPasswordConfig(authConfig, mockHandlers)

    expect(result.minPasswordLength).toBe(8)
    expect(result.maxPasswordLength).toBe(128)
  })
})

describe('buildRateLimitConfig', () => {
  test('returns disabled configuration', () => {
    const result = buildRateLimitConfig()

    expect(result).toEqual({
      enabled: false,
      window: 60,
      max: 100,
    })
  })
})

describe('buildAuthHooks', () => {
  test('returns hooks object with before middleware', () => {
    const result = buildAuthHooks()

    expect(result).toHaveProperty('before')
    expect(typeof result.before).toBe('function')
  })

  test('password validation rejects passwords shorter than 8 characters', async () => {
    const hooks = buildAuthHooks()
    const mockCtx = {
      path: '/admin/create-user',
      body: { password: '1234567' }, // 7 characters
    }

    await expect(hooks.before(mockCtx as any)).rejects.toThrow(
      'Password must be at least 8 characters'
    )
  })

  test('password validation rejects passwords longer than 128 characters', async () => {
    const hooks = buildAuthHooks()
    const longPassword = 'a'.repeat(129)
    const mockCtx = {
      path: '/admin/create-user',
      body: { password: longPassword },
    }

    await expect(hooks.before(mockCtx as any)).rejects.toThrow(
      'Password must not exceed 128 characters'
    )
  })

  test('password validation accepts valid 8-character password', async () => {
    const hooks = buildAuthHooks()
    const mockCtx = {
      path: '/admin/create-user',
      body: { password: '12345678' }, // Exactly 8 characters
    }

    await expect(hooks.before(mockCtx as any)).resolves.toBeUndefined()
  })

  test('password validation accepts valid 128-character password', async () => {
    const hooks = buildAuthHooks()
    const validPassword = 'a'.repeat(128)
    const mockCtx = {
      path: '/admin/create-user',
      body: { password: validPassword },
    }

    await expect(hooks.before(mockCtx as any)).resolves.toBeUndefined()
  })

  test('password validation does not run for other endpoints', async () => {
    const hooks = buildAuthHooks()
    const mockCtx = {
      path: '/auth/signin',
      body: { password: '123' }, // Invalid password, but should not be validated
    }

    await expect(hooks.before(mockCtx as any)).resolves.toBeUndefined()
  })

  test('password validation allows missing password field', async () => {
    const hooks = buildAuthHooks()
    const mockCtx = {
      path: '/admin/create-user',
      body: { email: 'user@example.com' }, // No password field
    }

    await expect(hooks.before(mockCtx as any)).resolves.toBeUndefined()
  })

  test('password validation allows undefined password', async () => {
    const hooks = buildAuthHooks()
    const mockCtx = {
      path: '/admin/create-user',
      body: { password: undefined },
    }

    await expect(hooks.before(mockCtx as any)).resolves.toBeUndefined()
  })
})

describe('buildAuthPlugins', () => {
  const mockHandlers = {
    passwordReset: mock(() => Promise.resolve()),
    verification: mock(() => Promise.resolve()),
    magicLink: mock(() => Promise.resolve()),
  }

  test('always includes openAPI plugin', () => {
    const result = buildAuthPlugins(mockHandlers, undefined)

    expect(result.length).toBeGreaterThanOrEqual(1)
    // First plugin should be openAPI
    expect(result[0]).toBeDefined()
  })

  test('includes only openAPI when no features enabled', () => {
    const authConfig: Auth = {}
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(1) // Only openAPI
  })

  test('includes admin plugin when enabled', () => {
    const authConfig: Auth = { admin: true }
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(2) // openAPI + admin
  })

  test('includes two-factor plugin when enabled', () => {
    const authConfig: Auth = { twoFactor: true }
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(2) // openAPI + twoFactor
  })

  test('includes magic link plugin when enabled', () => {
    const authConfig: Auth = { magicLink: true }
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(2) // openAPI + magicLink
  })

  test('includes all plugins when all enabled', () => {
    const authConfig: Auth = {
      admin: true,
      twoFactor: true,
      magicLink: true,
    }
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(4) // openAPI + admin + twoFactor + magicLink
  })

  test('includes only enabled plugins in combination', () => {
    const authConfig: Auth = {
      admin: true,
      magicLink: true,
      // twoFactor not enabled
    }
    const result = buildAuthPlugins(mockHandlers, authConfig)

    expect(result.length).toBe(3) // openAPI + admin + magicLink (no twoFactor)
  })
})
