/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * AgentApprovalEscalationSchema defines escalation behavior when an approval
 * request remains pending beyond a threshold.
 */
export const AgentApprovalEscalationSchema = Schema.Struct({
  /** Seconds before escalation triggers (must be less than parent timeout) */
  after: Schema.Finite.pipe(
    Schema.annotate({
      description: 'Seconds before escalation triggers (must be less than timeout)',
    }),
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),

  /** Role to escalate to (must exist in auth.roles) */
  to: Schema.String.pipe(
    Schema.annotate({
      description: 'Role to escalate to (must reference a role defined in auth.roles)',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentApprovalEscalation',
    title: 'Agent Approval Escalation',
    description: 'Escalation configuration for pending approval requests.',
  })
)

/** @public */
export type AgentApprovalEscalation = Schema.Schema.Type<typeof AgentApprovalEscalationSchema>

/**
 * AgentApprovalSchema defines human-in-the-loop approval workflows for agent actions.
 *
 * Approval modes:
 * - `none`: No approval required; agent executes immediately
 * - `all`: Every action requires human approval before execution
 * - `selective`: Only actions listed in `required` need approval; others execute freely
 */
export const AgentApprovalSchema = Schema.Struct({
  /** Approval mode: none (no approval), all (every action), or selective (specific actions) */
  mode: Schema.optional(
    Schema.Literals(['none', 'all', 'selective']).pipe(
      Schema.annotate({
        description:
          'Approval mode: none (no approval), all (every action), selective (specific actions only)',
      })
    )
  ),

  /** Actions requiring approval (required when mode is selective) */
  required: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'Action type requiring approval' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description:
          'Actions requiring approval (must be a subset of capabilities.actions). Required when mode=selective.',
        examples: [['record.delete', 'email.send']],
      })
    )
  ),

  /** Seconds before pending approval expires (defaults to 3600 = 1 hour) */
  timeout: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '3600',
        description: 'Seconds before a pending approval expires unexecuted',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Escalation configuration for pending approvals */
  escalation: Schema.optional(AgentApprovalEscalationSchema),
}).pipe(
  Schema.annotate({
    identifier: 'AgentApproval',
    title: 'Agent Approval',
    description:
      'Human-in-the-loop approval workflow configuration for agent actions. Controls which actions need human review before execution.',
  })
)

/** @public */
export type AgentApproval = Schema.Schema.Type<typeof AgentApprovalSchema>
