/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { EmailSendError, EmailSender } from '@/application/ports/services/email-sender'
import { sendEmail, sendEmailWithOptions } from './email-service'

/**
 * Live `EmailSender` over the shared Nodemailer transport.
 *
 * An explicit `from` is the sender, whole; without one the sender is the
 * operator's `SMTP_FROM`, displayed under `fromName` when the operator set
 * no `SMTP_FROM_NAME`.
 */
export const EmailSenderLive = Layer.succeed(
  EmailSender,
  EmailSender.of({
    send: ({ from, fromName, cc, bcc, replyTo, attachments, ...message }) =>
      Effect.tryPromise({
        try: () => {
          const recipients = {
            ...(cc === undefined ? {} : { cc: [...cc] }),
            ...(bcc === undefined ? {} : { bcc: [...bcc] }),
            ...(replyTo === undefined ? {} : { replyTo: [...replyTo] }),
            ...(attachments === undefined || attachments.length === 0
              ? {}
              : {
                  attachments: attachments.map((file) => ({
                    filename: file.filename,
                    contentType: file.contentType,
                    content: Buffer.from(file.content),
                    // Nodemailer sends a part with a `cid` inline, under that content id.
                    ...(file.contentId === undefined ? {} : { cid: file.contentId }),
                  })),
                }),
          }
          return from !== undefined && from !== ''
            ? sendEmailWithOptions({ ...message, ...recipients, from })
            : sendEmail({
                ...message,
                ...recipients,
                ...(fromName === undefined ? {} : { fromName }),
              })
        },
        catch: (cause) =>
          new EmailSendError({
            cause,
            message: cause instanceof Error ? cause.message : String(cause),
          }),
      }).pipe(Effect.withSpan('email.send')),
  })
)
