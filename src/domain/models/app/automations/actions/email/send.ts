/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Email Action (type: email, operator: send)
 *
 * Send emails using the configured SMTP transport (Nodemailer).
 */
export const EmailSendActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('email').pipe(
    Schema.annotate({
      description: "Constant value 'email' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('send').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'email' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    to: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Recipient email (supports template variables)' })
    ),
    subject: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Email subject (supports template variables)' })
    ),
    body: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Email body — HTML or plain text (supports template variables)',
      })
    ),
    from: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'From address override (default: app configured sender)',
        })
      )
    ),
    // Single-recipient strings AND arrays are accepted: in real-world YAML
    // configs operators frequently write `cc: 'manager@example.com'` instead
    // of `cc: ['manager@example.com']`. The handler normalises both into an
    // array before calling Nodemailer.
    cc: Schema.optional(
      Schema.Union([TemplateStringSchema, Schema.Array(TemplateStringSchema)]).pipe(
        Schema.annotate({ description: 'CC recipient(s) — single string or array' })
      )
    ),
    bcc: Schema.optional(
      Schema.Union([TemplateStringSchema, Schema.Array(TemplateStringSchema)]).pipe(
        Schema.annotate({ description: 'BCC recipient(s) — single string or array' })
      )
    ),
    replyTo: Schema.optional(
      Schema.Union([TemplateStringSchema, Schema.Array(TemplateStringSchema)]).pipe(
        Schema.annotate({ description: 'Reply-To recipient(s) — single string or array' })
      )
    ),
  }).annotate({
    description: 'The message to send: its recipients, subject, body and sender.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'EmailSendAction',
    title: 'Email Send Action',
    description: 'Send emails via configured SMTP transport',
  })
)

/** @public */
export type EmailSendAction = Schema.Schema.Type<typeof EmailSendActionSchema>
