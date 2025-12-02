/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EmailAndPasswordConfigSchema } from './email-and-password'
import { MagicLinkConfigSchema } from './magic-link'
import { PasskeyConfigSchema } from './passkey'

// Export individual method schemas
export * from './email-and-password'
export * from './magic-link'
export * from './passkey'

/**
 * Authentication Methods Configuration Schema
 *
 * All authentication methods in a single configuration object.
 * Each method is optional and can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * At least one method must be enabled for authentication to work.
 *
 * Available methods:
 * - emailAndPassword: Traditional credential-based authentication
 * - magicLink: Passwordless email link authentication
 * - passkey: WebAuthn biometric/security key authentication
 *
 * @example
 * ```typescript
 * // Simple methods
 * {
 *   methods: {
 *     emailAndPassword: true,
 *     magicLink: true
 *   }
 * }
 *
 * // Configured methods
 * {
 *   methods: {
 *     emailAndPassword: {
 *       requireEmailVerification: true,
 *       minPasswordLength: 12
 *     },
 *     passkey: {
 *       userVerification: 'required'
 *     }
 *   }
 * }
 * ```
 */
export const MethodsConfigSchema = Schema.Struct({
  emailAndPassword: Schema.optional(EmailAndPasswordConfigSchema),
  magicLink: Schema.optional(MagicLinkConfigSchema),
  passkey: Schema.optional(PasskeyConfigSchema),
}).pipe(
  Schema.annotations({
    title: 'Methods Configuration',
    description: 'All authentication methods configuration',
    examples: [
      { emailAndPassword: true },
      { emailAndPassword: true, magicLink: true },
      { emailAndPassword: { requireEmailVerification: true }, passkey: true },
    ],
  })
)

export type MethodsConfig = Schema.Schema.Type<typeof MethodsConfigSchema>

/**
 * Helper to check if a method is enabled
 */
export const isMethodEnabled = (
  methods: MethodsConfig | undefined,
  method: keyof MethodsConfig
): boolean => {
  if (!methods) return false
  const value = methods[method]
  if (typeof value === 'boolean') return value
  return value !== undefined
}

/**
 * Get all enabled method names
 */
export const getEnabledMethods = (
  methods: MethodsConfig | undefined
): readonly (keyof MethodsConfig)[] => {
  if (!methods) return []
  return (Object.keys(methods) as (keyof MethodsConfig)[]).filter((key) =>
    isMethodEnabled(methods, key)
  )
}

/**
 * Check if at least one method is enabled
 */
export const hasAnyMethodEnabled = (methods: MethodsConfig | undefined): boolean => {
  return getEnabledMethods(methods).length > 0
}
