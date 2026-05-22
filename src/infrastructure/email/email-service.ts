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

export class EmailError extends Data.TaggedError('EmailError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EmailConnectionError extends Data.TaggedError('EmailConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

const EMAIL_DISABLED_MESSAGE_ID = 'noop:email-disabled'

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

    verifyConnection: () =>
      Effect.tryPromise({
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

export async function sendEmail(options: Readonly<Omit<SendMailOptions, 'from'>>): Promise<string> {
  return deliver({ from: getDefaultFrom(), ...options })
}

export async function sendEmailWithOptions(options: Readonly<SendMailOptions>): Promise<string> {
  return deliver(options)
}
