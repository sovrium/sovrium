/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { EmailCategorySchema } from './send-headers'

/**
 * Email Suppress Action (type: email, operator: suppress)
 *
 * Adds an address to the suppression list every later bulk send consults. It
 * is how a bounce or a complaint reported by the mail provider reaches the
 * engine: a webhook automation, signed with the provider's own scheme, reads
 * the provider's report and calls this step. Provider-agnostic by
 * construction — the webhook trigger already verifies Svix, Stripe-style and
 * plain HMAC signatures — and `validate` refuses the step in an automation a
 * stranger could start without a credential (an unsigned webhook, a form).
 */
export const EmailSuppressActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('email').pipe(
    Schema.annotate({
      description: "Constant value 'email' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('suppress').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'email' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    address: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          "The address to stop mailing, usually read from the provider's report ('{{trigger.data.body.email}}'). Compared without case. A value that is not exactly one address fails the step.",
      })
    ),
    reason: Schema.Literals(['bounce', 'complaint', 'unsubscribe']).pipe(
      Schema.annotate({
        description:
          "Why the address is suppressed: 'bounce' for a permanent delivery failure, 'complaint' when the recipient marked a message as spam, 'unsubscribe' for a request received another way (a reply, a support ticket).",
      })
    ),
    category: Schema.optional(
      EmailCategorySchema.pipe(
        Schema.annotate({
          description:
            'The one category to suppress the address for. Without it the address is suppressed for every category, which is what a bounce or a complaint calls for.',
        })
      )
    ),
    messageId: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            "The Message-ID of the message the report is about, as the provider echoes it back. When it names a message a bulk send sent, the bounce or complaint is counted under that message's campaign in `email/stats`.",
        })
      )
    ),
  }).annotate({
    description: 'The address to suppress, why, for which category, and the message reported on.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'EmailSuppressAction',
    title: 'Email Suppress Action',
    description:
      'Stop mailing an address: record a bounce, a complaint or an unsubscribe on the suppression list later bulk sends consult',
  })
)

/** @public */
export type EmailSuppressAction = Schema.Schema.Type<typeof EmailSuppressActionSchema>
