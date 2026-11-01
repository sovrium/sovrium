/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Duration, Effect, Layer, Data } from 'effect'
import { parseEmailTransport } from '@/domain/models/process-env/email-transport'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { sendThroughEmailApi, type EmailApiTransport } from './email-api-transport'
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
 * Deliver an email through the selected transport — SMTP by default, or the
 * HTTP API `EMAIL_PROVIDER` names — or no-op when email is disabled.
 *
 * When no transport is configured: the intended message is
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
const deliver = (options: Readonly<SendMailOptions>): Effect.Effect<string, unknown> =>
  // The road is resolved INSIDE the effect, so a throw while reading the
  // configuration fails the send (an `EmailError` at the port) instead of
  // escaping as a defect.
  // @effect-diagnostics-next-line unknownInEffectCatch:off -- the error channel here is the peer's value, not one of ours
  Effect.try({ try: () => resolveRoad(options), catch: (cause: unknown) => cause }).pipe(
    Effect.flatMap((road): Effect.Effect<string, unknown> => {
      if (road.kind === 'disabled') return Effect.succeed(EMAIL_DISABLED_MESSAGE_ID)
      // An HTTP transport fails with its own `EmailApiError`, which names the
      // provider and status.
      if (road.kind === 'api') return sendThroughEmailApi(road.transport, options)
      return sendThroughSmtp(road.transporter, options)
    })
  )

/** Where one message goes: nowhere (reported only), an HTTP email API, or SMTP. */
type DeliveryRoad =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'api'; readonly transport: EmailApiTransport }
  | { readonly kind: 'smtp'; readonly transporter: SmtpTransporter }

type SmtpTransporter = NonNullable<ReturnType<typeof getTransporter>>

const DISABLED: DeliveryRoad = { kind: 'disabled' }

const resolveRoad = (options: Readonly<SendMailOptions>): DeliveryRoad => {
  if (!isEmailConfigured()) {
    reportUndeliverableMessage(options)
    return DISABLED
  }
  // `EMAIL_PROVIDER` picks the road; boot already refused a selector that names
  // no transport or lacks its credentials, so this resolves.
  const transport = parseEmailTransport(process.env)
  if (transport.kind !== 'smtp') return { kind: 'api', transport }
  const transporter = getTransporter()
  return transporter ? { kind: 'smtp', transporter } : DISABLED
}

/**
 * One SMTP send under the total budget. The transport's rejection stays on the
 * error channel VERBATIM; only the timeout path substitutes an error of its own.
 */
const sendThroughSmtp = (
  transporter: SmtpTransporter,
  options: Readonly<SendMailOptions>
): Effect.Effect<string, unknown> =>
  Effect.timeoutOrElse(
    // Deliberate `unknown` on the error channel: the transport's own rejection
    // must reach the caller VERBATIM — `EmailError` already wraps it and every
    // `catch` site reads `.message` off it.
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
  ).pipe(Effect.map((info) => info.messageId))

/** A send's failure as the port's `EmailError`, carrying the transport's own value. */
const toEmailError = (error: unknown): EmailError =>
  new EmailError({
    message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
    cause: error,
  })

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
    send: (options) => deliver(options).pipe(Effect.mapError(toEmailError)),

    sendWithDefaultFrom: (options) =>
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- the error channel here is the peer's value, mapped just below
      Effect.try({ try: () => getDefaultFrom(), catch: (cause: unknown) => cause }).pipe(
        Effect.flatMap((from) => deliver({ from, ...options })),
        Effect.mapError(toEmailError)
      ),

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
 * `fromName` is the sender display name to use when the operator set no
 * `SMTP_FROM_NAME` — callers pass the app's `name`, so an app's email arrives
 * from that app rather than from "Sovrium". It never reaches Nodemailer.
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
export async function sendEmail(
  options: Readonly<Omit<SendMailOptions, 'from'> & { readonly fromName?: string }>
): Promise<string> {
  const { fromName, ...message } = options
  // A Promise boundary by contract (Better Auth's callbacks await it), so the
  // send runs here; `runPromise` rejects with the raw failure value.
  return Effect.runPromise(deliver({ from: getDefaultFrom(fromName), ...message }))
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
  return Effect.runPromise(deliver(options))
}
