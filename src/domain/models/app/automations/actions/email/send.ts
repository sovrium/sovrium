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
  type: Schema.Literal('email'),
  operator: Schema.Literal('send'),
  props: Schema.Struct({
    to: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Recipient email (supports template variables)' })
    ),
    subject: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Email subject (supports template variables)' })
    ),
    body: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Email body — HTML or plain text (supports template variables)',
      })
    ),
    from: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'From address override (default: app configured sender)',
        })
      )
    ),
    // Single-recipient strings AND arrays are accepted: in real-world YAML
    // configs operators frequently write `cc: 'manager@example.com'` instead
    // of `cc: ['manager@example.com']`. The handler normalises both into an
    // array before calling Nodemailer (APP-AUTOMATION-ACTION-EMAIL-SEND-002).
    cc: Schema.optional(
      Schema.Union(TemplateStringSchema, Schema.Array(TemplateStringSchema)).pipe(
        Schema.annotations({ description: 'CC recipient(s) — single string or array' })
      )
    ),
    bcc: Schema.optional(
      Schema.Union(TemplateStringSchema, Schema.Array(TemplateStringSchema)).pipe(
        Schema.annotations({ description: 'BCC recipient(s) — single string or array' })
      )
    ),
    replyTo: Schema.optional(
      Schema.Union(TemplateStringSchema, Schema.Array(TemplateStringSchema)).pipe(
        Schema.annotations({ description: 'Reply-To recipient(s) — single string or array' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'EmailSendAction',
    title: 'Email Send Action',
    description: 'Send emails via configured SMTP transport',
  })
)

/** @public */
export type EmailSendAction = Schema.Schema.Type<typeof EmailSendActionSchema>
