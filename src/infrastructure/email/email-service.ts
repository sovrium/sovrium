/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer, Data } from 'effect'
import { transporter, getDefaultFrom, type SendMailOptions } from './nodemailer'

export class EmailError extends Data.TaggedError('EmailError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EmailConnectionError extends Data.TaggedError('EmailConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface EmailService {
  readonly send: (options: Readonly<SendMailOptions>) => Effect.Effect<string, EmailError>

  readonly sendWithDefaultFrom: (
    options: Readonly<Omit<SendMailOptions, 'from'>>
  ) => Effect.Effect<string, EmailError>

  readonly verifyConnection: () => Effect.Effect<boolean, EmailConnectionError>
}

export class Email extends Context.Tag('Email')<Email, EmailService>() {}

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

export async function sendEmail(options: Readonly<Omit<SendMailOptions, 'from'>>): Promise<string> {
  const info = await transporter.sendMail({
    from: getDefaultFrom(),
    ...options,
  })
  return info.messageId
}

export async function sendEmailWithOptions(options: Readonly<SendMailOptions>): Promise<string> {
  const info = await transporter.sendMail(options)
  return info.messageId
}
