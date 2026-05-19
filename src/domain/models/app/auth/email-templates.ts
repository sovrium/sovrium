/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AuthEmailTemplateSchema = Schema.Struct({
  subject: Schema.String.pipe(
    Schema.annotations({ description: 'Email subject line with optional $variable substitution' })
  ),
  text: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Plain text email body with optional $variable substitution',
      })
    )
  ),
  html: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'HTML email body with optional $variable substitution' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Auth Email Template',
    description: 'Email template configuration with subject and body content',
    examples: [
      { subject: 'Verify your email', text: 'Click here to verify: $url' },
      {
        subject: 'Reset your password',
        text: 'Click the link to reset your password: $url',
        html: '<p>Click <a href="$url">here</a> to reset your password.</p>',
      },
    ],
  })
)

export type AuthEmailTemplate = Schema.Schema.Type<typeof AuthEmailTemplateSchema>

export const AuthEmailTemplatesSchema = Schema.Struct({
  verification: Schema.optional(AuthEmailTemplateSchema),
  resetPassword: Schema.optional(AuthEmailTemplateSchema),
  magicLink: Schema.optional(AuthEmailTemplateSchema),
  emailOtp: Schema.optional(AuthEmailTemplateSchema),
  twoFactorBackupCodes: Schema.optional(AuthEmailTemplateSchema),
  welcome: Schema.optional(AuthEmailTemplateSchema),
  accountDeletion: Schema.optional(AuthEmailTemplateSchema),
  invitation: Schema.optional(AuthEmailTemplateSchema),
}).pipe(
  Schema.annotations({
    title: 'Auth Email Templates',
    description: 'Templates for all authentication-related emails',
    examples: [
      {
        verification: { subject: 'Verify your email', text: 'Click to verify: $url' },
        resetPassword: { subject: 'Reset your password', text: 'Reset link: $url' },
      },
    ],
  })
)

export type AuthEmailTemplates = Schema.Schema.Type<typeof AuthEmailTemplatesSchema>
