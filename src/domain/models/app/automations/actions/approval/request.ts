/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const ApprovalRequestActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('approval'),
  operator: Schema.Literal('request'),
  props: Schema.Struct({
    approvers: Schema.Union(
      Schema.Literal('all-admins'),
      Schema.Array(TemplateStringSchema).pipe(Schema.minItems(1))
    ).pipe(
      Schema.annotations({
        description: 'Who can approve: "all-admins" or an array of email addresses / role names',
      })
    ),

    message: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Message displayed to approvers (supports template variables)',
      })
    ),

    options: Schema.optional(
      Schema.Array(
        Schema.Struct({
          value: Schema.String.pipe(
            Schema.annotations({ description: 'Option value returned as step output' })
          ),
          label: Schema.optional(
            Schema.String.pipe(
              Schema.annotations({ description: 'Human-readable label for this option' })
            )
          ),
        })
      ).pipe(
        Schema.minItems(2),
        Schema.annotations({
          description:
            'Approval options (minimum 2). Default: [{ value: "approve" }, { value: "reject" }]',
        })
      )
    ),

    timeout: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^\d+\s*(m|h|d)$/),
        Schema.annotations({
          description: 'How long to wait for approval (e.g., "24h", "7d"). No timeout by default.',
        })
      )
    ),

    onTimeout: Schema.optional(
      Schema.Literal('approve', 'reject', 'escalate').pipe(
        Schema.annotations({
          description:
            'Action on timeout: approve (auto-approve), reject (auto-reject), escalate (notify escalation)',
        })
      )
    ),

    notifyVia: Schema.optional(
      Schema.Literal('email', 'webhook', 'both').pipe(
        Schema.annotations({
          description: 'Notification channel for approvers (default: email)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'ApprovalRequestAction',
    title: 'Approval Request Action',
    description: 'Pause execution and request human approval. Requires app.auth to be configured.',
  })
)

export type ApprovalRequestAction = Schema.Schema.Type<typeof ApprovalRequestActionSchema>
