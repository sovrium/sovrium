/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer, Data } from 'effect'
import { logWarning } from '../logging'
import { isEmailConfigured } from './email-config'
import { getTransporter, getDefaultFrom, type SendMailOptions } from './nodemailer'

/**
 * Email service error types
 */
export class EmailError extends Data.TaggedError('EmailError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EmailConnectionError extends Data.TaggedError('EmailConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Synthetic message id returned when email is disabled (no SMTP configured).
 */
const EMAIL_DISABLED_MESSAGE_ID = 'noop:email-disabled'

/**
 * Deliver an email through the SMTP transport, or no-op when email is disabled.
 *
 * When `SMTP_HOST` is unset there is no transport: the intended message is
 * logged and a synthetic id is returned without touching the network. This
 * keeps Better Auth and automation flows resolving cleanly instead of throwing
 * ECONNREFUSED against a non-existent local SMTP server.
 */
async function deliver(options: Readonly<SendMailOptions>): Promise<string> {
  if (!isEmailConfigured()) {
    logWarning(
      `[EMAIL] Email sending disabled (SMTP not configured) — skipped sending to "${String(
        options.to ?? 'unknown'
      )}" with subject "${String(options.subject ?? '')}"`
    )
    return EMAIL_DISABLED_MESSAGE_ID
  }

  const transporter = getTransporter()
  if (!transporter) return EMAIL_DISABLED_MESSAGE_ID
  const info = await transporter.sendMail(options)
  return info.messageId
}

/**
 * Email service interface
 *
 * Provides a functional interface for sending emails with Effect-based
 * error handling and composition.
 */
export interface EmailService {
  /**
   * Send an email
   *
   * @param options - Nodemailer mail options
   * @returns Effect that resolves with message info or fails with EmailError
   */
  readonly send: (options: Readonly<SendMailOptions>) => Effect.Effect<string, EmailError>

  /**
   * Send an email with the default "from" address
   *
   * @param options - Mail options without "from" field
   * @returns Effect that resolves with message info or fails with EmailError
   */
  readonly sendWithDefaultFrom: (
    options: Readonly<Omit<SendMailOptions, 'from'>>
  ) => Effect.Effect<string, EmailError>

  /**
   * Verify SMTP connection
   *
   * @returns Effect that resolves with true or fails with EmailConnectionError
   */
  readonly verifyConnection: Effect.Effect<boolean, EmailConnectionError>
}

/**
 * Email service tag for Effect dependency injection
 */
export class Email extends Context.Service<Email, EmailService>()('Email') {}

/**
 * Live implementation of EmailService using Nodemailer
 */
export const EmailLive = Layer.succeed(
  Email,
  Email.of({
    send: (options) =>
      Effect.tryPromise({
        try: () => deliver(options),
        catch: (error) =>
          new EmailError({
            message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      }),

    sendWithDefaultFrom: (options) =>
      Effect.tryPromise({
        try: () => deliver({ from: getDefaultFrom(), ...options }),
        catch: (error) =>
          new EmailError({
            message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      }),

    verifyConnection: Effect.tryPromise({
      try: async () => {
        const transporter = getTransporter()
        if (!transporter) return false
        return transporter.verify()
      },
      catch: (error) =>
        new EmailConnectionError({
          message: `SMTP connection failed: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    }),
  })
)

/**
 * Send email helper function (for use outside Effect context)
 *
 * This is a convenience function for Better Auth integration where
 * we need to use async/await directly instead of Effect.
 *
 * When email is disabled (SMTP not configured) this logs the intended message
 * and resolves with a synthetic id instead of sending.
 *
 * @example
 * ```typescript
 * import { sendEmail } from '@/infrastructure/email/email-service'
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<h1>Welcome!</h1>',
 * })
 * ```
 */
export async function sendEmail(options: Readonly<Omit<SendMailOptions, 'from'>>): Promise<string> {
  return deliver({ from: getDefaultFrom(), ...options })
}

/**
 * Send email with full options (including custom "from")
 *
 * When email is disabled (SMTP not configured) this logs the intended message
 * and resolves with a synthetic id instead of sending.
 *
 * @example
 * ```typescript
 * import { sendEmailWithOptions } from '@/infrastructure/email/email-service'
 *
 * await sendEmailWithOptions({
 *   from: '"Custom Sender" <custom@example.com>',
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   text: 'Hello World',
 * })
 * ```
 * @public
 */
export async function sendEmailWithOptions(options: Readonly<SendMailOptions>): Promise<string> {
  return deliver(options)
}
