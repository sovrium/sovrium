/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Duration, Effect, Layer, Data } from 'effect'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { getTransporter, getDefaultFrom, type SendMailOptions } from './nodemailer'
import { reportUndeliverableMessage } from './undeliverable-message'

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
 * Total budget for one SMTP send, across every phase (standing rule E6).
 *
 * The transport is ALREADY bounded per phase — `createTransporter` sets
 * `connectionTimeout`, `greetingTimeout` and `socketTimeout`, each 10 s by
 * default and each env-overridable — and those bounds are the ones that
 * matter, because they cut the socket. This is the backstop above them: a
 * per-phase timer resets on every byte, so a relay that dribbles one byte at a
 * time never trips any of them and the send runs indefinitely. 30 s is three
 * default phases, so the transport's more specific error still wins in every
 * ordinary failure and this only fires on the pathological one.
 *
 * The automation `email` action keeps its own, TIGHTER 15 s budget
 * (`action-handlers/email.ts`): that one is sized against an HTTP request that
 * awaits the send inline, which is a different question from "has this send
 * stopped making progress".
 */
const SMTP_SEND_TIMEOUT_MS = 30_000

/**
 * The total-send budget expired with the transport still mid-exchange.
 *
 * Tagged rather than a bare `Error` so it stays distinguishable from a
 * rejection nodemailer itself produced: everything else reaching {@link deliver}'s
 * caller is the transport's own value, and this is the one failure Sovrium
 * invented. It surfaces through `EmailError` like any other send failure.
 */
class SmtpSendTimeoutError extends Data.TaggedError('SmtpSendTimeoutError')<{
  readonly timeoutMs: number
  readonly message: string
}> {}

/**
 * Deliver an email through the SMTP transport, or no-op when email is disabled.
 *
 * When `SMTP_HOST` is unset there is no transport: the intended message is
 * REPORTED and a synthetic id is returned without touching the network. This
 * keeps Better Auth and automation flows resolving cleanly instead of throwing
 * ECONNREFUSED against a non-existent local SMTP server.
 *
 * How much of the message is reported depends on who is reading the stream —
 * the whole thing in a developer's journal, one line in a production log. See
 * {@link reportUndeliverableMessage}, which owns that decision so this function
 * stays about delivery.
 *
 * NEVER RETRIED, at any level. A send that times out may already have been
 * accepted by the relay, and the caller cannot tell a lost response from a
 * lost request — so a retry is a second email in the recipient's inbox.
 */
async function deliver(options: Readonly<SendMailOptions>): Promise<string> {
  if (!isEmailConfigured()) {
    reportUndeliverableMessage(options)
    return EMAIL_DISABLED_MESSAGE_ID
  }

  const transporter = getTransporter()
  if (!transporter) return EMAIL_DISABLED_MESSAGE_ID
  // Effect 4's `runPromise` rejects with the RAW failure value, so a transport
  // rejection still reaches the callers' own `catch` unchanged; only the
  // timeout path substitutes an error of its own.
  const info = await Effect.runPromise(
    Effect.timeoutOrElse(
      // Deliberate `unknown` on the error channel: the transport's own rejection
      // must reach this function's caller VERBATIM — `EmailError` already wraps
      // it and every `catch` site reads `.message` off it.
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- the error channel here is the peer's value, not one of ours
      Effect.tryPromise({
        try: () => transporter.sendMail(options),
        catch: (cause: unknown) => cause,
      }),
      {
        duration: Duration.millis(SMTP_SEND_TIMEOUT_MS),
        orElse: () =>
          Effect.fail(
            new SmtpSendTimeoutError({
              timeoutMs: SMTP_SEND_TIMEOUT_MS,
              message: `SMTP send made no progress within ${String(SMTP_SEND_TIMEOUT_MS)}ms and was abandoned`,
            })
          ),
      }
    )
  )
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
