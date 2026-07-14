/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Duration, Effect } from 'effect'
import { sanitizeRichTextHTML, stripHtmlToText } from '@/domain/utils/html-sanitization'
import { sendEmail } from '@/infrastructure/email/email-service'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

class EmailSendActionError extends Data.TaggedError('EmailSendActionError')<{
  readonly cause: unknown
  readonly message: string
}> {}

const EMAIL_SEND_TIMEOUT_MS = 15_000

const withSendTimeout = <A>(
  effect: Effect.Effect<A, EmailSendActionError>
): Effect.Effect<A, EmailSendActionError> =>
  effect.pipe(
    Effect.timeoutFail({
      duration: Duration.millis(EMAIL_SEND_TIMEOUT_MS),
      onTimeout: () =>
        new EmailSendActionError({
          cause: undefined,
          message: `SMTP send exceeded ${String(EMAIL_SEND_TIMEOUT_MS)}ms`,
        }),
    })
  )

const toRecipientArray = (raw: unknown): readonly string[] | undefined => {
  if (raw === undefined) return undefined
  if (typeof raw === 'string') return raw === '' ? undefined : [raw]
  if (Array.isArray(raw)) {
    const filtered = raw.filter((v): v is string => typeof v === 'string' && v !== '')
    return filtered.length === 0 ? undefined : filtered
  }
  return undefined
}

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

    const textBody = stripHtmlToText(body).trim()
    const result = yield* withSendTimeout(
      Effect.tryPromise({
        try: () =>
          sendEmail({
            to,
            subject,
            html: sanitizeRichTextHTML(body),
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
      })
    ).pipe(Effect.either)

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
