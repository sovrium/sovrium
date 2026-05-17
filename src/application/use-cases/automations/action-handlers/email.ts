/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { sendEmail } from '@/infrastructure/email/email-service'
import { stringProp } from './shared'
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

/**
 * `email/send` handler — sends an HTML email via the SMTP transport
 * configured by `EMAIL_SMTP_*` env vars (Better Auth password-reset uses
 * the same transport). Templates in `to`/`subject`/`body`/`cc`/`bcc`/
 * `replyTo` were resolved by the run loop's `resolveTriggerInValue` pass,
 * so by the time this handler runs the props are concrete strings.
 *
 * The body is sent as HTML (`html` field) per spec EMAIL-SEND-003 — most
 * customer YAML defines body content with HTML markup and Mailpit reads
 * `email.HTML` to assert formatting. Plain-text-only configs still send
 * (Nodemailer accepts an HTML payload that happens to contain no tags).
 */
export const handleEmailSend: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const to = stringProp(props, 'to')
    const subject = stringProp(props, 'subject')
    const body = stringProp(props, 'body')
    if (!to) return { status: 'failure', error: 'email.send requires a `to` address' } as const
    if (!subject) return { status: 'failure', error: 'email.send requires a `subject`' } as const

    const fromOverride = stringProp(props, 'from')
    const cc = toRecipientArray(props['cc'])
    const bcc = toRecipientArray(props['bcc'])
    const replyTo = toRecipientArray(props['replyTo'])

    // Strip HTML tags into a plain-text fallback so SMTP gateways enforcing
    // RFC 5322 multipart conventions (Mailpit's strict mode + some
    // production gateways) don't 554 on html-only messages. Operators who
    // configure plain-text bodies still see the same body in both parts.
    const textBody = body.replaceAll(/<[^>]*>/g, '').trim()
    const result = yield* Effect.tryPromise({
      try: () =>
        sendEmail({
          to,
          subject,
          html: body,
          text: textBody === '' ? body : textBody,
          ...(fromOverride !== '' ? { from: fromOverride } : {}),
          ...(cc !== undefined ? { cc: [...cc] } : {}),
          ...(bcc !== undefined ? { bcc: [...bcc] } : {}),
          ...(replyTo !== undefined ? { replyTo: [...replyTo] } : {}),
        }),
      catch: (error) =>
        new EmailSendActionError({
          cause: error,
          message: error instanceof Error ? error.message : String(error),
        }),
    }).pipe(Effect.either)

    if (result._tag === 'Left') {
      return {
        status: 'failure',
        error: `email.send failed: ${result.left.message}`,
      } as const satisfies ActionOutcome
    }
    return {
      status: 'success',
      output: { messageId: result.right },
    } as const satisfies ActionOutcome
  })
