/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EnvRefSchema } from '../common/env-ref'

export { EnvRefSchema }
export type { EnvRef } from '../common/env-ref'

/**
 * Auth Email Template Schema
 *
 * Configuration for a single authentication email template.
 * Templates support variable substitution using $variable syntax.
 *
 * Available variables depend on the email type:
 * - $url: Link URL (verification, password reset, magic link)
 * - $name: User's name
 * - $email: User's email address
 * - $code: OTP code (for email-otp)
 * - $organizationName: Organization name (for invitations)
 * - $inviterName: Name of person who sent invitation
 *
 * @example
 * ```typescript
 * {
 *   subject: 'Reset your password',
 *   text: 'Click the link to reset your password: $url'
 * }
 * ```
 */
export const AuthEmailTemplateSchema = Schema.Struct({
  /** Email subject line (can include $variables) */
  subject: Schema.String.pipe(
    Schema.annotations({ description: 'Email subject line with optional $variable substitution' })
  ),
  /** Plain text email body (can include $variables) */
  text: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Plain text email body with optional $variable substitution',
      })
    )
  ),
  /** HTML email body (can include $variables) */
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

/**
 * Auth Email Templates Schema
 *
 * All available email templates for authentication flows.
 * Each template is optional - Better Auth provides sensible defaults.
 *
 * @example
 * ```typescript
 * {
 *   verification: {
 *     subject: 'Verify your email for MyApp',
 *     text: 'Hi $name, click here to verify your email: $url'
 *   },
 *   resetPassword: {
 *     subject: 'Reset your password',
 *     text: 'Click the link to reset your password: $url'
 *   }
 * }
 * ```
 */
export const AuthEmailTemplatesSchema = Schema.Struct({
  /** Email verification after signup */
  verification: Schema.optional(AuthEmailTemplateSchema),
  /** Password reset email */
  resetPassword: Schema.optional(AuthEmailTemplateSchema),
  /** Magic link login email */
  magicLink: Schema.optional(AuthEmailTemplateSchema),
  /** Email OTP code email */
  emailOtp: Schema.optional(AuthEmailTemplateSchema),
  /** Organization invitation email */
  organizationInvitation: Schema.optional(AuthEmailTemplateSchema),
  /** Two-factor authentication backup codes email */
  twoFactorBackupCodes: Schema.optional(AuthEmailTemplateSchema),
  /** Welcome email after verification */
  welcome: Schema.optional(AuthEmailTemplateSchema),
  /** Account deletion confirmation email */
  accountDeletion: Schema.optional(AuthEmailTemplateSchema),
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

/**
 * Default Admin User Schema
 *
 * Configuration for creating a default admin user on first startup.
 * This is useful for bootstrapping the application with an initial admin.
 *
 * @example
 * ```typescript
 * {
 *   email: 'admin@myapp.com',
 *   password: '$ADMIN_PASSWORD',
 *   name: 'Admin User'
 * }
 * ```
 */
export const DefaultAdminSchema = Schema.Struct({
  /** Admin user email address */
  email: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    Schema.annotations({ description: 'Admin email address' })
  ),
  /** Admin user password (env var reference for security) */
  password: EnvRefSchema.pipe(
    Schema.annotations({ description: 'Admin password (must be env var reference)' })
  ),
  /** Admin user display name */
  name: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    title: 'Default Admin User',
    description: 'Initial admin user created on first startup',
    examples: [
      { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD' },
      { email: 'admin@myapp.com', password: '$ADMIN_PASSWORD', name: 'System Admin' },
    ],
  })
)

export type DefaultAdmin = Schema.Schema.Type<typeof DefaultAdminSchema>
