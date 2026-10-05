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
  type: Schema.Literal('approval').pipe(
    Schema.annotate({
      description: "Constant value 'approval' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('request').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'approval' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /**
     * Who can approve — literal 'all-admins' or array of emails/role names.
     * Checked against the caller's session when the request is resolved;
     * templated entries are rendered once, when the request is created.
     */
    approvers: Schema.optional(
      Schema.Union([
        Schema.Literal('all-admins'),
        Schema.Array(TemplateStringSchema).pipe(Schema.check(Schema.isMinLength(1))),
      ]).pipe(
        Schema.annotate({
          description:
            'Who may resolve the request: "all-admins" (any admin: the built-in admin role or the top role the app declares; a read-only operator role is not one) or an array of email addresses and role names. Anyone else is answered as if the request did not exist. Omitted means all-admins.',
        })
      )
    ),

    /** Message shown to approvers */
    message: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Message displayed to approvers (supports template variables)',
      })
    ),

    /** Approval options (default: approve/reject) */
    options: Schema.optional(
      Schema.Array(
        Schema.Struct({
          value: Schema.String.pipe(
            Schema.annotate({ description: 'Option value returned as step output' })
          ),
          label: Schema.optional(
            Schema.String.pipe(
              Schema.annotate({ description: 'Human-readable label for this option' })
            )
          ),
        })
      ).pipe(
        Schema.annotate({
          description:
            'Approval options (minimum 2). Default: [{ value: "approve" }, { value: "reject" }]',
        }),
        Schema.check(Schema.isMinLength(2))
      )
    ),

    /** Timeout before automatic action */
    timeout: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'How long to wait for an answer (e.g., "24h", "7d"). Needs `onTimeout`. Omitted, the request waits indefinitely.',
        }),
        Schema.check(Schema.isPattern(/^\d+\s*(m|h|d)$/))
      )
    ),

    /** What happens when timeout is reached */
    onTimeout: Schema.optional(
      Schema.Literals(['approve', 'reject', 'escalate']).pipe(
        Schema.annotate({
          description:
            'What the engine decides once `timeout` passes: approve (resumes the run) or reject (ends it, or continues it under `onReject: continue`). Required when `timeout` is set.',
        })
      )
    ),

    /**
     * What a rejection does to the run. `stop` (the default) ends it there, as a
     * rejection always has. `continue` resumes it past this step exactly as an
     * approval does, with the step output's `decision` reading `rejected`, so a
     * later step can record the outcome. A timeout resolved by `onTimeout:
     * reject` is a rejection and follows the same rule.
     */
    onReject: Schema.optional(
      Schema.Literals(['stop', 'continue']).pipe(
        Schema.annotate({
          description:
            "What a rejection does to the run: 'stop' ends it (default); 'continue' resumes it past this step, as an approval does, with the step output's `decision` set to `rejected` so a later step can record the outcome. A timeout resolved by `onTimeout: reject` follows the same rule.",
        })
      )
    ),

    /** How to notify approvers */
    notifyVia: Schema.optional(
      Schema.Literals(['email', 'webhook', 'both']).pipe(
        Schema.annotate({
          description: 'Notification channel for approvers (default: email)',
        })
      )
    ),
  }).annotate({
    description:
      'Who has to approve, what they are shown, and what happens if nobody answers in time.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'ApprovalRequestAction',
    title: 'Approval Request Action',
    description: 'Pause execution and request human approval. Requires app.auth to be configured.',
  })
)

/** @public */
export type ApprovalRequestAction = Schema.Schema.Type<typeof ApprovalRequestActionSchema>
