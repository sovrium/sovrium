/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer, Data } from 'effect'
import { transporter, getDefaultFrom, type SendMailOptions } from './nodemailer'

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
  readonly verifyConnection: () => Effect.Effect<boolean, EmailConnectionError>
}

/**
 * Email service tag for Effect dependency injection
 */
export class Email extends Context.Tag('Email')<Email, EmailService>() {}

/**
 * Live implementation of EmailService using Nodemailer
 */
export const EmailLive = Layer.succeed(
  Email,
  Email.of({
    send: (options) =>
      Effect.tryPromise({
        try: async () => {
          const info = await transporter.sendMail(options)
          return info.messageId
        },
        catch: (error) =>
          new EmailError({
            message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      }),

    sendWithDefaultFrom: (options) =>
      Effect.tryPromise({
        try: async () => {
          const info = await transporter.sendMail({
            from: getDefaultFrom(),
            ...options,
          })
          return info.messageId
        },
        catch: (error) =>
          new EmailError({
            message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      }),

    verifyConnection: () =>
      Effect.tryPromise({
        try: () => transporter.verify(),
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
  const info = await transporter.sendMail({
    from: getDefaultFrom(),
    ...options,
  })
  return info.messageId
}

/**
 * Send email with full options (including custom "from")
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
 */
export async function sendEmailWithOptions(options: Readonly<SendMailOptions>): Promise<string> {
  const info = await transporter.sendMail(options)
  return info.messageId
}
