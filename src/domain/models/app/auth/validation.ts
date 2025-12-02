/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AuthenticationMethod } from './methods'
import type { OAuthConfig } from './oauth'
import type { PluginsConfig } from './plugins'

/**
 * Auth Configuration for Validation
 *
 * Interface representing the auth configuration structure
 * used for cross-field validation.
 */
export interface AuthConfigForValidation {
  readonly methods: readonly AuthenticationMethod[]
  readonly oauth?: OAuthConfig
  readonly plugins?: PluginsConfig
}

/**
 * Validation Result
 */
export interface ValidationResult {
  readonly success: boolean
  readonly message?: string
}

/**
 * Validation Rules for Auth Configuration
 *
 * These rules ensure incompatible features aren't combined
 * and that required dependencies are met.
 */

/**
 * Rule 1: Two-factor authentication requires a primary auth method
 *
 * 2FA is a second factor and requires a primary authentication method
 * like email-and-password or passkey.
 */
export const validateTwoFactorRequiresPrimary = (
  config: AuthConfigForValidation
): ValidationResult => {
  const hasTwoFactor = config.plugins?.twoFactor

  if (!hasTwoFactor) {
    return { success: true }
  }

  const hasPrimaryAuth = config.methods.some((method) => {
    const methodName = typeof method === 'string' ? method : method.method
    return methodName === 'email-and-password' || methodName === 'passkey'
  })

  if (!hasPrimaryAuth) {
    return {
      success: false,
      message: 'Two-factor authentication requires email-and-password or passkey authentication',
    }
  }

  return { success: true }
}

/**
 * Rule 2: OAuth requires at least one provider
 *
 * If OAuth is configured, it must have at least one provider.
 * This is already enforced by Schema.NonEmptyArray but we
 * include it for explicit documentation.
 */
export const validateOAuthHasProviders = (config: AuthConfigForValidation): ValidationResult => {
  if (!config.oauth) {
    return { success: true }
  }

  const { providers } = config.oauth
  if (!providers || providers.length === 0) {
    return {
      success: false,
      message: 'OAuth configuration requires at least one provider',
    }
  }

  return { success: true }
}

/**
 * Rule 3: Passkey is recommended with HTTPS
 *
 * This is a warning rather than an error. Passkey/WebAuthn
 * requires HTTPS in production but may work in development
 * with localhost.
 */
export const validatePasskeyWithHTTPS = (
  config: AuthConfigForValidation,
  isProduction: boolean
): ValidationResult => {
  const hasPasskey = config.methods.some(
    (method) => method === 'passkey' || (typeof method === 'object' && method.method === 'passkey')
  )

  if (hasPasskey && isProduction) {
    // This would need to be checked at runtime against the actual URL
    // For now, we just flag it as a consideration
    return { success: true }
  }

  return { success: true }
}

/**
 * Run all validation rules
 *
 * Returns the first validation failure or success.
 */
export const validateAuthConfig = (config: AuthConfigForValidation): ValidationResult => {
  const rules = [validateTwoFactorRequiresPrimary, validateOAuthHasProviders]

  return rules.reduce<ValidationResult>((acc, rule) => (acc.success ? rule(config) : acc), {
    success: true,
  })
}

/**
 * Get method name from authentication method (string or object)
 */
export const getAuthMethodName = (method: AuthenticationMethod): string => {
  if (typeof method === 'string') {
    return method
  }
  return method.method
}

/**
 * Check if a specific authentication method is enabled
 */
export const hasAuthMethod = (config: AuthConfigForValidation, methodName: string): boolean => {
  return config.methods.some((method) => getAuthMethodName(method) === methodName)
}
