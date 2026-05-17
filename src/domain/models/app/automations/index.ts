/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAccessSchema } from '@/domain/models/shared/ai-access'
import { PermissionValueSchema } from '@/domain/models/shared/permissions'
import { type Action, ActionSchema } from './actions'
import { RetryConfigSchema } from './retry'
import { TriggerSchema } from './trigger'

/**
 * Recursively collect all action names (including nested in path/loop props)
 */
const collectActionNames = (
  actions: ReadonlyArray<{ readonly name: string; readonly type: string }>
): readonly string[] => {
  return actions.flatMap((action) => {
    const pathNames =
      action.type === 'path' && 'props' in action
        ? (
            action as {
              readonly props: {
                readonly paths: ReadonlyArray<{
                  readonly actions: ReadonlyArray<{
                    readonly name: string
                    readonly type: string
                  }>
                }>
              }
            }
          ).props.paths.flatMap((p) => collectActionNames(p.actions))
        : []

    const loopNames =
      action.type === 'loop' && 'props' in action
        ? collectActionNames(
            (
              action as {
                readonly props: {
                  readonly actions: ReadonlyArray<{
                    readonly name: string
                    readonly type: string
                  }>
                }
              }
            ).props.actions
          )
        : []

    return [action.name, ...pathNames, ...loopNames]
  })
}

// ─── Automation Schema ──────────────────────────────────────────────────────

/**
 * Single Automation Schema
 *
 * An automation is a workflow with one trigger and a sequence of actions.
 * Actions execute sequentially unless a PathAction branches execution.
 *
 * Data flows between steps via template variables:
 * - {{trigger.data.fieldName}} — access trigger payload
 * - {{stepName.result}} — access previous step output
 * - $env.VAR_NAME — access environment variable (never logged)
 */
export const AutomationSchema = Schema.Struct({
  /** Unique automation name (kebab-case, used in webhook URLs) */
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Unique automation name (kebab-case, e.g., "new-order-notification")',
    })
  ),

  /** Human-readable label */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this automation' })
    )
  ),

  /** Description of what this automation does */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Description of what this automation does' })
    )
  ),

  /** Whether this automation is enabled (default: true) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether this automation is active (default: true)' })
    )
  ),

  /** Trigger that starts this automation */
  trigger: TriggerSchema,

  /** Sequential list of actions to execute */
  actions: Schema.Array(ActionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Ordered list of actions to execute when triggered' })
  ),

  /** Automation-level retry configuration (applies to the entire workflow) */
  retry: Schema.optional(RetryConfigSchema),

  /** Timeout for the entire automation run in milliseconds */
  timeout: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1000, 900_000),
      Schema.annotations({
        description: 'Total automation timeout in ms (1000-900000, default: 300000)',
      })
    )
  ),

  /** Tags for organization and filtering */
  tags: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Tags for organizing automations' })
    )
  ),

  /** Per-automation permission configuration */
  permissions: Schema.optional(
    Schema.Struct({
      /** Who can trigger this automation (e.g., via chat commands, manual trigger) */
      trigger: Schema.optional(
        PermissionValueSchema.pipe(
          Schema.annotations({
            description: "Who can trigger this automation. 'all', 'authenticated', or role array.",
          })
        )
      ),
    }).pipe(
      Schema.annotations({
        identifier: 'AutomationPermissions',
        description: 'Per-automation permission configuration',
      })
    )
  ),

  /**
   * AI/MCP exposure configuration.
   *
   * Declares this automation as eligible for invocation via Sovrium's MCP
   * server. Only manual-trigger automations may set this — record / cron /
   * webhook triggers fire on their own and cannot be invoked by an AI client.
   *
   * Cross-validation enforced at AppSchema level: setting `aiAccess` on a
   * non-manual-trigger automation produces a decode error.
   *
   * Whether the operator actually mounts the MCP server is controlled
   * separately via `MCP_ENABLED`. This flag is the schema author's
   * declaration of intent; the operator decides activation.
   *
   * @example AI-callable manual automation
   * ```typescript
   * trigger: { type: 'manual', label: 'Send Q-Report', requiredRole: 'admin' },
   * aiAccess: {
   *   enabled: true,
   *   description: 'Generate and email the quarterly sales report.',
   *   annotations: { readOnly: false, destructive: false, idempotent: false },
   *   requireConfirmation: true,
   * }
   * ```
   *
   * @see AiAccessSchema for full configuration options
   */
  aiAccess: Schema.optional(AiAccessSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Automation',
    title: 'Automation',
    description:
      'A workflow with one trigger and a sequence of actions. Data flows between steps via template variables.',
    examples: [
      {
        name: 'welcome-email',
        label: 'Send Welcome Email',
        trigger: { type: 'auth' as const, events: ['signUp' as const] },
        actions: [
          {
            name: 'sendEmail',
            type: 'email' as const,
            operator: 'send' as const,
            props: {
              to: '{{trigger.data.user.email}}',
              subject: 'Welcome to our platform!',
              body: '<h1>Welcome, {{trigger.data.user.name}}!</h1>',
            },
          },
        ],
      },
    ],
  }),
  Schema.filter((automation) => {
    const actionNames = collectActionNames(automation.actions as ReadonlyArray<Action>)
    const uniqueNames = new Set(actionNames)
    if (actionNames.length !== uniqueNames.size) {
      return `Automation '${automation.name}' has duplicate action names`
    }
    return true
  })
)

export type Automation = Schema.Schema.Type<typeof AutomationSchema>
/** @public */
export type AutomationEncoded = Schema.Schema.Encoded<typeof AutomationSchema>

/**
 * Automations Array Schema
 *
 * Top-level array of automations with unique name validation.
 */
export const AutomationsSchema = Schema.Array(AutomationSchema).pipe(
  Schema.annotations({
    identifier: 'Automations',
    title: 'Automations',
    description: 'List of workflow automations with triggers and actions',
  }),
  Schema.filter((automations) => {
    const names = automations.map((a) => a.name)
    const uniqueNames = new Set(names)
    return names.length === uniqueNames.size || 'Automation names must be unique'
  })
)

/** @public */
export type Automations = Schema.Schema.Type<typeof AutomationsSchema>

// Re-export all sub-modules
export * from './actions'
export * from './conditions'
export * from './retry'
export * from './template'
export * from './trigger'
