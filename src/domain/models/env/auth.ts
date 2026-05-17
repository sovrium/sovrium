/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Authentication environment configuration.
 *
 * Env vars: AUTH_SECRET, AUTH_ADMIN_EMAIL, AUTH_ADMIN_PASSWORD, AUTH_ADMIN_NAME
 */
export const AuthEnvSchema = Schema.Struct({
  authSecret: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(16),
      Schema.annotations({
        description: 'Secret key for signing tokens and cookies (AUTH_SECRET)',
      })
    )
  ),
  adminEmail: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      Schema.annotations({
        description: 'Default admin email (AUTH_ADMIN_EMAIL)',
        examples: ['admin@example.com'],
      })
    )
  ),
  adminPassword: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(8),
      Schema.annotations({
        description: 'Default admin password (AUTH_ADMIN_PASSWORD)',
      })
    )
  ),
  adminName: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Default admin display name (AUTH_ADMIN_NAME)',
        examples: ['System Administrator'],
      })
    )
  ),
})

export type AuthEnvConfig = Schema.Schema.Type<typeof AuthEnvSchema>

/** @public */
export const parseAuthEnvConfig = (): AuthEnvConfig =>
  Schema.decodeUnknownSync(AuthEnvSchema)({
    authSecret: process.env.AUTH_SECRET,
    adminEmail: process.env.AUTH_ADMIN_EMAIL,
    adminPassword: process.env.AUTH_ADMIN_PASSWORD,
    adminName: process.env.AUTH_ADMIN_NAME,
  })
