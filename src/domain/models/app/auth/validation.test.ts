/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
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
      methods: { magicLink: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with emailAndPassword', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with passkey', () => {
    const config: AuthConfigForValidation = {
      methods: { passkey: true },
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with emailAndPassword as config object', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: { minPasswordLength: 12 } },
      plugins: { twoFactor: { issuer: 'MyApp' } },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should fail when two-factor is enabled without primary auth', () => {
    const config: AuthConfigForValidation = {
      methods: { magicLink: true },
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe(
      'Two-factor authentication requires emailAndPassword or passkey authentication'
    )
  })
})

describe('validateOAuthHasProviders', () => {
  test('should pass when no OAuth is configured', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should pass when OAuth has providers', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
      oauth: { providers: ['google', 'github'] },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should fail when OAuth has empty providers array', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
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
      methods: { emailAndPassword: true },
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured in production', () => {
    const config: AuthConfigForValidation = {
      methods: { passkey: true },
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured in development', () => {
    const config: AuthConfigForValidation = {
      methods: { passkey: true },
    }
    const result = validatePasskeyWithHTTPS(config, false)
    expect(result.success).toBe(true)
  })

  test('should pass when passkey is configured as config object', () => {
    const config: AuthConfigForValidation = {
      methods: { passkey: { userVerification: 'required' } },
    }
    const result = validatePasskeyWithHTTPS(config, true)
    expect(result.success).toBe(true)
  })
})

describe('validateAuthConfig', () => {
  test('should pass for valid minimal configuration', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should pass for valid configuration with OAuth and plugins', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true, passkey: true },
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
      methods: { magicLink: true },
      plugins: { twoFactor: true },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Two-factor')
  })
})

describe('hasAuthMethod', () => {
  test('should return true for boolean method', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true, magicLink: true },
    }
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
    expect(hasAuthMethod(config, 'magicLink')).toBe(true)
  })

  test('should return false for missing method', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true },
    }
    expect(hasAuthMethod(config, 'passkey')).toBe(false)
    expect(hasAuthMethod(config, 'magicLink')).toBe(false)
  })

  test('should return true for method with config object', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: { minPasswordLength: 12 } },
    }
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
  })

  test('should handle mixed boolean and config object methods', () => {
    const config: AuthConfigForValidation = {
      methods: {
        magicLink: true,
        emailAndPassword: { minPasswordLength: 12 },
      },
    }
    expect(hasAuthMethod(config, 'magicLink')).toBe(true)
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
    expect(hasAuthMethod(config, 'passkey')).toBe(false)
  })

  test('should return false for method set to false', () => {
    const config: AuthConfigForValidation = {
      methods: { emailAndPassword: true, magicLink: false },
    }
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
    expect(hasAuthMethod(config, 'magicLink')).toBe(false)
  })
})
