/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Email Infrastructure Module
 *
 * Provides email functionality using Nodemailer with Better Auth integration.
 *
 * ## Configuration
 *
 * Set the following environment variables for production SMTP:
 *
 * ```bash
 * SMTP_HOST=smtp.example.com      # SMTP server hostname
 * SMTP_PORT=587                   # SMTP port (587 for TLS, 465 for SSL)
 * SMTP_USER=your-username         # SMTP authentication username
 * SMTP_PASS=your-password         # SMTP authentication password
 * SMTP_SECURE=false               # Use SSL (optional, auto-detected from port)
 * SMTP_FROM=noreply@example.com   # Default "from" email address
 * SMTP_FROM_NAME=Your App         # Default "from" display name
 * ```
 *
 * If SMTP_HOST is not set, emails are sent via Ethereal (test SMTP service).
 *
 * ## Usage
 *
 * ### Direct Usage (async/await)
 * ```typescript
 * import { sendEmail } from '@/infrastructure/email'
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<h1>Welcome!</h1>',
 *   text: 'Welcome!',
 * })
 * ```
 *
 * ### Effect Service Usage
 * ```typescript
 * import { Email, EmailLive } from '@/infrastructure/email'
 * import { Effect } from 'effect'
 *
 * const program = Effect.gen(function* () {
 *   const email = yield* Email
 *   yield* email.sendWithDefaultFrom({
 *     to: 'user@example.com',
 *     subject: 'Welcome',
 *     html: '<h1>Welcome!</h1>',
 *   })
 * }).pipe(Effect.provide(EmailLive))
 * ```
 *
 * ### Using Templates
 * ```typescript
 * import { sendEmail, passwordResetEmail } from '@/infrastructure/email'
 *
 * const template = passwordResetEmail({
 *   userName: 'John',
 *   resetUrl: 'https://example.com/reset?token=...',
 * })
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   ...template,
 * })
 * ```
 *
 * @module
 */

// Nodemailer configuration and transporter
export {
  transporter,
  getDefaultFrom,
  getEmailConfig,
  createTransporter,
  verifyConnection,
  type EmailConfig,
  type SendMailOptions,
} from './nodemailer'

// Effect service layer
export {
  Email,
  EmailLive,
  EmailError,
  EmailConnectionError,
  sendEmail,
  sendEmailWithOptions,
  type EmailService,
} from './email-service'

// Email configuration with Effect logging
export { getEmailConfigFromEffect } from './email-config'

// Email templates
export {
  passwordResetEmail,
  emailVerificationEmail,
  organizationInviteEmail,
  type PasswordResetEmailData,
  type EmailVerificationData,
  type OrganizationInviteData,
} from './templates'
