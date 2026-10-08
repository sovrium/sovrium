/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Duration, Effect } from 'effect'
import { EmailSender, type EmailAttachment } from '@/application/ports/services/email-sender'
import { sanitizeRichTextHTML, stripHtmlToText } from '@/domain/kernel/sanitize/html-sanitization'
import { resolveFileRef, type FileRefScope, type ResolvedFile } from './document-file-ref'
import { failureOf, typedOwnProp, type Raw } from './document-run'
import { templatedEmail } from './email-template-body'
import { fileRefsOf } from './file-ref-origin'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * Tagged error for the inner `sendEmail` promise. Wrapping the unknown
 * rejection in a Data.TaggedError keeps the Effect error channel
 * discriminable (effect/globalErrorInEffectCatch) — the surrounding
 * handler still surfaces a string error in the ActionOutcome via
 * `Effect.either`, but the intermediate channel is now type-safe.
 *
 * `cause` carries the original error so a debugger / structured logger
 * can recover the upstream Nodemailer / SMTP failure if needed.
 */
class EmailSendActionError extends Data.TaggedError('EmailSendActionError')<{
  readonly cause: unknown
  readonly message: string
}> {}

/**
 * Backstop timeout for the synchronous SMTP send. The nodemailer transport is
 * already bounded (connection/greeting/socket timeouts, see
 * infrastructure/email/nodemailer.ts), but a half-open socket could in theory
 * slip past those; this outer bound guarantees the email action — and any
 * synchronous caller that awaits it, such as the comment-create POST that runs
 * a comment automation inline — fails fast (as an ActionOutcome failure)
 * instead of stalling up to nodemailer's ~2min connect default. Set comfortably
 * above the transport bounds so the transport's more specific error usually
 * wins, and well under a typical HTTP request budget.
 */
const EMAIL_SEND_TIMEOUT_MS = 15_000

/**
 * Wrap the SMTP-send Effect with the fail-fast backstop. On timeout it fails
 * with an `EmailSendActionError` so the caller's `Effect.either` surfaces it
 * through the same Left/failure path a transport error takes — the send never
 * throws and never stalls past {@link EMAIL_SEND_TIMEOUT_MS}.
 */
const withSendTimeout = <A>(
  effect: Effect.Effect<A, EmailSendActionError>
): Effect.Effect<A, EmailSendActionError> =>
  effect.pipe(
    // EFFECT 4: `timeoutFail({duration, onTimeout})` -> `timeoutOrElse` with an
    // `Effect.fail` fallback (migration/v3-to-v4.md:9833) — the error value
    // becomes a failed Effect rather than a bare value.
    Effect.timeoutOrElse({
      duration: Duration.millis(EMAIL_SEND_TIMEOUT_MS),
      orElse: () =>
        Effect.fail(
          new EmailSendActionError({
            cause: undefined,
            message: `SMTP send exceeded ${String(EMAIL_SEND_TIMEOUT_MS)}ms`,
          })
        ),
    })
  )

/**
 * Normalise a recipient prop (cc/bcc/replyTo) to an array. Both string and
 * array shapes are accepted by the schema (operators frequently write
 * `cc: 'one@example.com'` instead of an array); Nodemailer accepts either,
 * but normalising once keeps the option object's shape predictable for
 * downstream telemetry.
 */
const toRecipientArray = (raw: unknown): readonly string[] | undefined => {
  if (raw === undefined) return undefined
  if (typeof raw === 'string') return raw === '' ? undefined : [raw]
  if (Array.isArray(raw)) {
    const filtered = raw.filter((v): v is string => typeof v === 'string' && v !== '')
    return filtered.length === 0 ? undefined : filtered
  }
  return undefined
}

/** The most a message may carry in attachments: 15 MB of files (15 × 1024 × 1024 bytes). */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

/** The parts of a message a step sends: its HTML, its text, its attachments. */
interface MessageBody {
  readonly html: string
  readonly text: string
  readonly attachments: readonly EmailAttachment[]
}

/** An inline `body`: rich text, sanitized as page content; its text part derived from it. */
const inlineBody = (body: string): MessageBody => {
  // Strip HTML tags into a plain-text fallback so SMTP gateways enforcing
  // RFC 5322 multipart conventions (Mailpit's strict mode + some
  // production gateways) don't 554 on html-only messages.
  const textBody = stripHtmlToText(body).trim()
  return {
    html: sanitizeRichTextHTML(body),
    text: textBody === '' ? body : textBody,
    attachments: [],
  }
}

/** The refusal of a message whose attachments and inline pictures pass the 15 MB cap. */
const attachmentsTooLarge = (detail: string): Readonly<EmailSendActionError> =>
  new EmailSendActionError({
    cause: undefined,
    message: `attachments_too_large: ${detail}, over the 15 MB a message may carry; link to a bucket file instead`,
  })

/**
 * Every attachment, read whole, or the reason the message cannot go. Each is
 * read against what is left of the 15 MB, so a stored file past it is refused
 * by its catalogued size before a byte of it is buffered.
 */
const readAttachments = (props: Raw, scope: FileRefScope) =>
  Effect.gen(function* () {
    const { runContext } = scope
    const refs = fileRefsOf(
      typedOwnProp(props, 'attachments', runContext),
      'attachments',
      runContext
    )
    const files = yield* Effect.reduce(
      refs,
      (): readonly ResolvedFile[] => [],
      (read, ref) => {
        const used = read.reduce((sum, file) => sum + file.bytes.length, 0)
        return resolveFileRef(ref, scope, MAX_ATTACHMENT_BYTES - used).pipe(
          Effect.mapError((error) =>
            error.oversized === undefined
              ? error
              : attachmentsTooLarge(`with ${error.oversized} the attachments add up to more bytes`)
          ),
          Effect.map((file) => [...read, file])
        )
      }
    )
    return files.map((file): EmailAttachment => ({
      filename: file.filename,
      contentType: file.contentType,
      content: file.bytes,
    }))
  })

const totalBytes = (parts: ReadonlyArray<EmailAttachment>): number =>
  parts.reduce((sum, part) => sum + part.content.length, 0)

/** The message's subject, body and attachments, as its props describe them. */
const messageBody = (props: Raw, scope: FileRefScope) =>
  Effect.gen(function* () {
    const files = yield* readAttachments(props, scope)
    if (props['template'] === undefined) {
      const inline = inlineBody(stringProp(props, 'body'))
      return { ...inline, subject: stringProp(props, 'subject'), attachments: files }
    }
    const templated = yield* templatedEmail(props, scope)
    // The pictures the template shows inline travel in the same message.
    const total = totalBytes(files) + totalBytes(templated.inline)
    if (total > MAX_ATTACHMENT_BYTES) {
      return yield* attachmentsTooLarge(
        `the attachments and inline pictures add up to ${String(total)} bytes`
      )
    }
    return {
      html: templated.html,
      text: templated.text,
      subject: templated.subject ?? stringProp(props, 'subject'),
      attachments: [...files, ...templated.inline],
    }
  })

/**
 * `email/send` handler — sends an HTML email via the SMTP transport
 * configured by `EMAIL_SMTP_*` env vars (Better Auth password-reset uses
 * the same transport). Templates in `to`/`subject`/`body`/`cc`/`bcc`/
 * `replyTo` were resolved by the run loop's `resolveTriggerInValue` pass,
 * so by the time this handler runs the props are concrete strings. A
 * `template` (and `text`) is left as written by that pass and rendered here,
 * against `data` only.
 *
 * Attachments travel whole or not at all: one that cannot be read, or a set
 * over 15 MB with the template's inline pictures, fails the step before the
 * transport is called.
 */
export const handleEmailSend: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const to = stringProp(props, 'to')
    if (!to) return { status: 'failure', error: 'email.send requires a `to` address' } as const

    const body = yield* Effect.result(messageBody(props, { app, automation, runContext }))
    if (body._tag === 'Failure') return failureOf('email.send failed', body.failure)
    const { subject } = body.success
    if (!subject) return { status: 'failure', error: 'email.send requires a `subject`' } as const

    const fromOverride = stringProp(props, 'from')
    // `withSendTimeout` bounds the send so a slow/half-open SMTP greeting fails
    // fast into the Left/failure path below rather than stalling the
    // (synchronous) caller — e.g. a comment automation awaited inside a POST.
    const mailer = yield* EmailSender
    const result = yield* withSendTimeout(
      mailer
        .send({
          to,
          subject,
          html: body.success.html,
          text: body.success.text,
          // An explicit `from` is the sender, whole; without one the sender
          // is the operator's SMTP_FROM, displayed under the app's name.
          ...(fromOverride !== '' ? { from: fromOverride } : { fromName: app.name }),
          cc: toRecipientArray(props['cc']),
          bcc: toRecipientArray(props['bcc']),
          replyTo: toRecipientArray(props['replyTo']),
          ...(body.success.attachments.length > 0 ? { attachments: body.success.attachments } : {}),
        })
        .pipe(
          Effect.mapError(
            (error) => new EmailSendActionError({ cause: error.cause, message: error.message })
          )
        )
    ).pipe(Effect.result)

    if (result._tag === 'Failure') {
      return {
        status: 'failure',
        error: `email.send failed: ${result.failure.message}`,
      } as const satisfies ActionOutcome
    }
    return {
      status: 'success',
      output: { messageId: result.success },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-email-send', { attributes: actionAttributes(action) })
  )
