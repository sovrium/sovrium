/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EmailAndPasswordMethodSchema } from './email-and-password'
import { MagicLinkMethodSchema } from './magic-link'
import { PasskeyMethodSchema } from './passkey'

// Export all authentication method schemas
export * from './email-and-password'
export * from './magic-link'
export * from './passkey'

/**
 * Authentication Method Schema
 *
 * Union of all supported authentication methods.
 * Each method can be:
 * - A simple string literal (e.g., 'email-and-password')
 * - A configuration object with method-specific options
 *
 * Supported methods:
 * - email-and-password: Traditional credential-based authentication
 * - magic-link: Passwordless email link authentication
 * - passkey: WebAuthn biometric/security key authentication
 *
 * @example
 * ```typescript
 * // Simple methods
 * const methods = ['email-and-password', 'magic-link']
 *
 * // Mixed with configuration
 * const methods = [
 *   { method: 'email-and-password', minPasswordLength: 12 },
 *   'magic-link',
 *   { method: 'passkey', userVerification: 'required' }
 * ]
 * ```
 */
export const AuthenticationMethodSchema = Schema.Union(
  EmailAndPasswordMethodSchema,
  MagicLinkMethodSchema,
  PasskeyMethodSchema
).pipe(
  Schema.annotations({
    title: 'Authentication Method',
    description: 'Available authentication methods (can be string or config object)',
    examples: [
      'email-and-password',
      'magic-link',
      'passkey',
      { method: 'email-and-password', requireEmailVerification: true },
      { method: 'passkey', userVerification: 'required' },
    ],
  })
)

/**
 * TypeScript type for authentication methods
 */
export type AuthenticationMethod = Schema.Schema.Type<typeof AuthenticationMethodSchema>

/**
 * Simple authentication method literals (for type checking)
 */
export const AuthenticationMethodLiteralSchema = Schema.Literal(
  'email-and-password',
  'magic-link',
  'passkey'
).pipe(
  Schema.annotations({
    title: 'Authentication Method Literal',
    description: 'Simple authentication method identifiers',
  })
)

export type AuthenticationMethodLiteral = Schema.Schema.Type<
  typeof AuthenticationMethodLiteralSchema
>

/**
 * Helper to extract the method name from a method (string or config)
 */
export const getMethodName = (method: AuthenticationMethod): AuthenticationMethodLiteral => {
  if (typeof method === 'string') {
    return method
  }
  return method.method
}
