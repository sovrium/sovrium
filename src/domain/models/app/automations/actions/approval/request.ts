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
 * Approval Action (type: approval, operator: request)
 *
 * Pause automation execution and request human approval before continuing.
 * The automation run enters a 'waiting' state until an approver responds.
 *
 * Requires app.auth to be configured (to identify approvers).
 */
export const ApprovalRequestActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('approval'),
  operator: Schema.Literal('request'),
  props: Schema.Struct({
    /** Who can approve — literal 'all-admins' or array of emails/role names */
    approvers: Schema.Union(
      Schema.Literal('all-admins'),
      Schema.Array(TemplateStringSchema).pipe(Schema.minItems(1))
    ).pipe(
      Schema.annotations({
        description: 'Who can approve: "all-admins" or an array of email addresses / role names',
      })
    ),

    /** Message shown to approvers */
    message: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Message displayed to approvers (supports template variables)',
      })
    ),

    /** Approval options (default: approve/reject) */
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

    /** Timeout before automatic action */
    timeout: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^\d+\s*(m|h|d)$/),
        Schema.annotations({
          description: 'How long to wait for approval (e.g., "24h", "7d"). No timeout by default.',
        })
      )
    ),

    /** What happens when timeout is reached */
    onTimeout: Schema.optional(
      Schema.Literal('approve', 'reject', 'escalate').pipe(
        Schema.annotations({
          description:
            'Action on timeout: approve (auto-approve), reject (auto-reject), escalate (notify escalation)',
        })
      )
    ),

    /** How to notify approvers */
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

/** @public */
export type ApprovalRequestAction = Schema.Schema.Type<typeof ApprovalRequestActionSchema>
