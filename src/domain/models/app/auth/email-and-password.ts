/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Authentication method types
 *
 * Defines the available authentication methods:
 * - 'email-and-password': Traditional email/password authentication
 *
 * @example
 * ```typescript
 * const methods: AuthenticationMethod[] = ['email-and-password']
 * ```
 */
export const AuthenticationMethodSchema = Schema.Literal('email-and-password').pipe(
  Schema.annotations({
    title: 'Authentication Method',
    description: 'Available authentication methods',
  })
)

/**
 * TypeScript type for authentication methods
 */
export type AuthenticationMethod = Schema.Schema.Type<typeof AuthenticationMethodSchema>
