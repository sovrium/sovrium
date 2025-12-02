/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  hasAuthMethod,
  isMethodEnabled,
  validateAuthConfig,
  validateOAuthHasProviders,
  validateTwoFactorRequiresPrimary,
} from './validation'
import type { AuthConfigForValidation } from './validation'

describe('validateTwoFactorRequiresPrimary', () => {
  test('should pass when no two-factor is configured', () => {
    const config: AuthConfigForValidation = {
      magicLink: true,
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with emailAndPassword', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should pass when two-factor is enabled with emailAndPassword as config object', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: { minPasswordLength: 12 },
      plugins: { twoFactor: { issuer: 'MyApp' } },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(true)
  })

  test('should fail when two-factor is enabled without emailAndPassword', () => {
    const config: AuthConfigForValidation = {
      magicLink: true,
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe(
      'Two-factor authentication requires emailAndPassword authentication'
    )
  })

  test('should fail when two-factor is enabled with only oauth', () => {
    const config: AuthConfigForValidation = {
      oauth: { providers: ['google'] },
      plugins: { twoFactor: true },
    }
    const result = validateTwoFactorRequiresPrimary(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe(
      'Two-factor authentication requires emailAndPassword authentication'
    )
  })
})

describe('validateOAuthHasProviders', () => {
  test('should pass when no OAuth is configured', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should pass when OAuth has providers', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
      oauth: { providers: ['google', 'github'] },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(true)
  })

  test('should fail when OAuth has empty providers array', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
      oauth: { providers: [] as unknown as ['google'] },
    }
    const result = validateOAuthHasProviders(config)
    expect(result.success).toBe(false)
    expect(result.message).toBe('OAuth configuration requires at least one provider')
  })
})

describe('validateAuthConfig', () => {
  test('should pass for valid minimal configuration', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should pass for valid configuration with OAuth and plugins', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
      oauth: { providers: ['google', 'github'] },
      plugins: {
        twoFactor: true,
        admin: true,
      },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should pass for oauth-only configuration', () => {
    const config: AuthConfigForValidation = {
      oauth: { providers: ['google', 'github'] },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(true)
  })

  test('should fail on first validation error (2FA without emailAndPassword)', () => {
    const config: AuthConfigForValidation = {
      magicLink: true,
      plugins: { twoFactor: true },
    }
    const result = validateAuthConfig(config)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Two-factor')
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

  test('should return false for undefined method', () => {
    expect(isMethodEnabled({ emailAndPassword: true }, 'magicLink')).toBe(false)
  })

  test('should return true for method with config object', () => {
    expect(
      isMethodEnabled({ emailAndPassword: { minPasswordLength: 12 } }, 'emailAndPassword')
    ).toBe(true)
  })

  test('should return false for undefined config', () => {
    expect(isMethodEnabled(undefined, 'emailAndPassword')).toBe(false)
  })
})

describe('hasAuthMethod', () => {
  test('should return true for boolean method', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
      magicLink: true,
    }
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
    expect(hasAuthMethod(config, 'magicLink')).toBe(true)
  })

  test('should return true for oauth method', () => {
    const config: AuthConfigForValidation = {
      oauth: { providers: ['google'] },
    }
    expect(hasAuthMethod(config, 'oauth')).toBe(true)
  })

  test('should return false for missing method', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: true,
    }
    expect(hasAuthMethod(config, 'oauth')).toBe(false)
    expect(hasAuthMethod(config, 'magicLink')).toBe(false)
  })

  test('should return true for method with config object', () => {
    const config: AuthConfigForValidation = {
      emailAndPassword: { minPasswordLength: 12 },
    }
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
  })

  test('should handle mixed boolean and config object methods', () => {
    const config: AuthConfigForValidation = {
      magicLink: true,
      emailAndPassword: { minPasswordLength: 12 },
    }
    expect(hasAuthMethod(config, 'magicLink')).toBe(true)
    expect(hasAuthMethod(config, 'emailAndPassword')).toBe(true)
    expect(hasAuthMethod(config, 'oauth')).toBe(false)
  })
})
