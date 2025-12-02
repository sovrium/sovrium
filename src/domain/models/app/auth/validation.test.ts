/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  getAuthMethodName,
  hasAuthMethod,
  validateAuthConfig,
  validateOAuthHasProviders,
  validatePasskeyWithHTTPS,
  validateTwoFactorRequiresPrimary,
} from './validation'
import type { AuthConfigForValidation } from './validation'

describe('validateTwoFactorRequiresPrimary', () => {
  test('should pass when no two-factor is configured', () => {
    const config: AuthConfigForValidation = {
      authentication: ['magic-link'],
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with email-and-password', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with passkey', () => {
    const config: AuthConfigForValidation = {
      authentication: ['passkey'],
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with email-and-password as object', () => {
    const config: AuthConfigForValidation = {
      authentication: [{ method: 'email-and-password', minPasswordLength: 12 }],
      plugins: { twoFactor: { issuer: 'MyApp' } },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should fail when two-factor is enabled without primary auth', () => {
    const config: AuthConfigForValidation = {
      authentication: ['magic-link'],
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe(
      'Two-factor authentication requires email-and-password or passkey authentication'
    )
  })
})

describe('validateOAuthHasProviders', () => {
  test('should pass when no OAuth is configured', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should pass when OAuth has providers', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
      oauth: { providers: ['google', 'github'] },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should fail when OAuth has empty providers array', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
      oauth: { providers: [] as unknown as ['google'] },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe('OAuth configuration requires at least one provider')
  })
})

describe('validatePasskeyWithHTTPS', () => {
  test('should pass when no passkey is configured', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured in production', () => {
    const config: AuthConfigForValidation = {
      authentication: ['passkey'],
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured in development', () => {
    const config: AuthConfigForValidation = {
      authentication: ['passkey'],
    }
    const result = validatePasskeyWithHTTPS(config, false)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured as object', () => {
    const config: AuthConfigForValidation = {
      authentication: [{ method: 'passkey', userVerification: 'required' }],
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })
})

describe('validateAuthConfig', () => {
  test('should pass for valid minimal configuration', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should pass for valid configuration with OAuth and plugins', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password', 'passkey'],
      oauth: { providers: ['google', 'github'] },
      plugins: {
        twoFactor: true,
        admin: true,
      },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should fail on first validation error (2FA without primary auth)', () => {
    const config: AuthConfigForValidation = {
      authentication: ['magic-link'],
      plugins: { twoFactor: true },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Two-factor')
  })
})

describe('getAuthMethodName', () => {
  test('should return string method name directly', () => {
    expect(getAuthMethodName('email-and-password')).toBe('email-and-password')
    expect(getAuthMethodName('magic-link')).toBe('magic-link')
    expect(getAuthMethodName('passkey')).toBe('passkey')
  })

  test('should extract method name from config object', () => {
    expect(getAuthMethodName({ method: 'email-and-password', minPasswordLength: 12 })).toBe(
      'email-and-password'
    )
    expect(getAuthMethodName({ method: 'passkey', userVerification: 'required' })).toBe('passkey')
  })
})

describe('hasAuthMethod', () => {
  test('should return true for string method', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password', 'magic-link'],
    }
    expect(hasAuthMethod(config, 'email-and-password')).toBe(true)
    expect(hasAuthMethod(config, 'magic-link')).toBe(true)
  })

  test('should return false for missing method', () => {
    const config: AuthConfigForValidation = {
      authentication: ['email-and-password'],
    }
    expect(hasAuthMethod(config, 'passkey')).toBe(false)
    expect(hasAuthMethod(config, 'magic-link')).toBe(false)
  })

  test('should return true for method in config object', () => {
    const config: AuthConfigForValidation = {
      authentication: [{ method: 'email-and-password', minPasswordLength: 12 }],
    }
    expect(hasAuthMethod(config, 'email-and-password')).toBe(true)
  })

  test('should handle mixed string and object methods', () => {
    const config: AuthConfigForValidation = {
      authentication: ['magic-link', { method: 'email-and-password', minPasswordLength: 12 }],
    }
    expect(hasAuthMethod(config, 'magic-link')).toBe(true)
    expect(hasAuthMethod(config, 'email-and-password')).toBe(true)
    expect(hasAuthMethod(config, 'passkey')).toBe(false)
  })
})
