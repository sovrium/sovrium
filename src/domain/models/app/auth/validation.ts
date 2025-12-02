/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EmailAndPasswordConfig } from './methods/email-and-password'
import type { MagicLinkConfig } from './methods/magic-link'
import type { OAuthConfig } from './oauth'
import type { PluginsConfig } from './plugins'

/**
 * Auth Configuration for Validation
 *
 * Interface representing the flattened auth configuration structure
 * used for cross-field validation.
 */
export interface AuthConfigForValidation {
  readonly emailAndPassword?: EmailAndPasswordConfig
  readonly magicLink?: MagicLinkConfig
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
 * Check if a specific authentication method is enabled
 */
export const isMethodEnabled = (
  config: AuthConfigForValidation | undefined,
  method: 'emailAndPassword' | 'magicLink' | 'oauth'
): boolean => {
  if (!config) return false
  const value = config[method]
  if (typeof value === 'boolean') return value
  return value !== undefined
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
 * like emailAndPassword.
 */
export const validateTwoFactorRequiresPrimary = (
  config: AuthConfigForValidation
): ValidationResult => {
  const hasTwoFactor = config.plugins?.twoFactor

  if (!hasTwoFactor) {
    return { success: true }
  }

  const hasEmailAndPassword = isMethodEnabled(config, 'emailAndPassword')

  if (!hasEmailAndPassword) {
    return {
      success: false,
      message: 'Two-factor authentication requires emailAndPassword authentication',
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
 * Check if a specific authentication method is enabled (alias)
 */
export const hasAuthMethod = (
  config: AuthConfigForValidation,
  methodName: 'emailAndPassword' | 'magicLink' | 'oauth'
): boolean => {
  return isMethodEnabled(config, methodName)
}
