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
 * Email Stats Action (type: email, operator: stats)
 *
 * Counts the bulk messages sent under a campaign or a category, and how many
 * were opened, bounced, complained about and unsubscribed from. The output is
 * plain numbers, so a following step writes them where the app shows them —
 * a broadcast's own row, a dashboard table — instead of the engine owning a
 * stats screen.
 */
export const EmailStatsActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('email').pipe(
    Schema.annotate({
      description: "Constant value 'email' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('stats').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'email' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    campaign: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Count the messages sent with this `campaign`, such as `broadcast-{{trigger.data.id}}`.',
        })
      )
    ),
    category: Schema.optional(
      EmailCategorySchema.pipe(
        Schema.annotate({
          description: 'Count the messages sent with this `category`.',
        })
      )
    ),
  })
    .annotate({
      description:
        'Which messages to count: a campaign, a category, or both (messages matching both).',
    })
    .pipe(
      Schema.check(
        Schema.makeFilter((props) => props.campaign !== undefined || props.category !== undefined, {
          message: 'email/stats needs `campaign`, `category` or both',
        })
      )
    ),
}).pipe(
  Schema.annotate({
    identifier: 'EmailStatsAction',
    title: 'Email Stats Action',
    description:
      'Count the messages a campaign or a category sent, opened, bounced, complained about and unsubscribed from',
  })
)

/** @public */
export type EmailStatsAction = Schema.Schema.Type<typeof EmailStatsActionSchema>
