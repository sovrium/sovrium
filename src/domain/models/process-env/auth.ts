/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EMAIL_PATTERN, MAX_EMAIL_LENGTH } from '@/domain/kernel/sanitize/email-validation'

/**
 * Authentication environment configuration.
 *
 * Env vars: AUTH_SECRET, AUTH_ADMIN_EMAIL, AUTH_ADMIN_PASSWORD, AUTH_ADMIN_NAME
 */
export const AuthEnvSchema = Schema.Struct({
  authSecret: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(16)),
      Schema.annotate({
        description: 'Secret key for signing tokens and cookies (AUTH_SECRET)',
      })
    )
  ),
  adminEmail: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMaxLength(MAX_EMAIL_LENGTH), Schema.isPattern(EMAIL_PATTERN)),
      Schema.annotate({
        description: 'Default admin email (AUTH_ADMIN_EMAIL)',
        examples: ['admin@example.com'],
      })
    )
  ),
  adminPassword: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(8)),
      Schema.annotate({
        description: 'Default admin password (AUTH_ADMIN_PASSWORD)',
      })
    )
  ),
  adminName: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Default admin display name (AUTH_ADMIN_NAME)',
        examples: ['System Administrator'],
      })
    )
  ),
})
