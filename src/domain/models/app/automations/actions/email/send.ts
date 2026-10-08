/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import {
  FileRefSchema,
  fileRefListSchema,
  HtmlTemplateSourceSchema,
  TemplateDataSchema,
  TemplateLocaleSchema,
  templateSourceSchema,
} from '../document/shared'

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
    subject: Schema.Union([
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "Email subject as a string, filled from the run's values like any prop ('Invoice {{trigger.data.number}}')",
        })
      ),
      templateSourceSchema('text').pipe(
        Schema.annotate({
          description:
            'Email subject as a template — { inline }, { asset } or { key, bucket? } — rendered from data like the body, with its helpers, partials and translations, and never HTML-escaped. Requires template.',
        })
      ),
    ]).pipe(
      Schema.annotate({
        description:
          'Email subject: a string filled from the run, or a template source rendered from data (with template)',
      })
    ),
    body: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Email body — HTML or plain text (supports template variables). Exactly one of body and template.',
        })
      )
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
    // ── Templated body and attachments (additive) ──
    // A template sees `data` only and is rendered by the action with HTML
    // escaping; the run's generic pass never touches its text (the
    // `templateContext` annotation on `inline`). Trust follows the author: an
    // `assets` template keeps inline `style`, a bucket template is cleaned like
    // `body`.
    template: Schema.optional(
      HtmlTemplateSourceSchema.pipe(
        Schema.annotate({
          description:
            'HTML body rendered from a template — { asset }, { key, bucket? } or { inline } — filled from data. Exactly one of body and template.',
        })
      )
    ),
    data: Schema.optional(
      TemplateDataSchema.pipe(
        Schema.annotate({
          description:
            'Values the template and text read by name ({{invoice.number}}). Requires template.',
        })
      )
    ),
    text: Schema.optional(
      templateSourceSchema('text').pipe(
        Schema.annotate({
          description:
            'Plain-text part rendered from the same data, without HTML escaping. Requires template; without it the plain-text part is derived from the HTML.',
        })
      )
    ),
    inlineCss: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'true',
          description:
            "Copy the rules of the template's <style> blocks onto the elements they match, as style attributes, before the message is cleaned; the <style> blocks themselves are never sent. false drops them without inlining. Applies to asset and inline templates; a bucket template loses every style.",
        })
      )
    ),
    locale: Schema.optional(TemplateLocaleSchema),
    attachments: Schema.optional(
      fileRefListSchema(FileRefSchema).pipe(
        Schema.annotate({
          description:
            'Files attached to the message: { step }, a key, { key, bucket }, { asset } or { record }. If one cannot be read the step fails and nothing is sent.',
        })
      )
    ),
  })
    .annotate({
      description:
        'The message to send: its recipients, subject, body or template, attachments and sender.',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter(
          (props) =>
            (props.body === undefined) !== (props.template === undefined) &&
            (props.template !== undefined ||
              (props.data === undefined &&
                props.text === undefined &&
                typeof props.subject === 'string' &&
                props.inlineCss === undefined &&
                props.locale === undefined)),
          {
            message:
              'email/send takes exactly one of `body` and `template`; `data`, `text`, a templated `subject`, `inlineCss` and `locale` require `template`',
          }
        )
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'EmailSendAction',
    title: 'Email Send Action',
    description: 'Send emails via configured SMTP transport',
  })
)

/** @public */
export type EmailSendAction = Schema.Schema.Type<typeof EmailSendActionSchema>
