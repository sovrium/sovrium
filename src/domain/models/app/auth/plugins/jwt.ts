/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * JWT Plugin Configuration
 *
 * Enables JSON Web Token mode for authentication.
 * Useful for non-cookie environments and microservices.
 *
 * When enabled, sessions use JWTs instead of server-side sessions.
 *
 * @example
 * ```typescript
 * // Enable JWT mode
 * { plugins: { jwt: true } }
 * ```
 */
export const JWTConfigSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'JWT Plugin',
    description: 'Enable JWT token mode for authentication',
  })
)

export type JWTConfig = Schema.Schema.Type<typeof JWTConfigSchema>
