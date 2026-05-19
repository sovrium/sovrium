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


export const AutomationSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z][a-z0-9-]*$/),
    Schema.maxLength(100),
    Schema.annotations({
      description: 'Unique automation name (kebab-case, e.g., "new-order-notification")',
    })
  ),

  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this automation' })
    )
  ),

  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Description of what this automation does' })
    )
  ),

  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether this automation is active (default: true)' })
    )
  ),

  trigger: TriggerSchema,

  actions: Schema.Array(ActionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Ordered list of actions to execute when triggered' })
  ),

  retry: Schema.optional(RetryConfigSchema),

  timeout: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1000, 900_000),
      Schema.annotations({
        description: 'Total automation timeout in ms (1000-900000, default: 300000)',
      })
    )
  ),

  tags: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Tags for organizing automations' })
    )
  ),

  permissions: Schema.optional(
    Schema.Struct({
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
export type AutomationEncoded = Schema.Schema.Encoded<typeof AutomationSchema>

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

export type Automations = Schema.Schema.Type<typeof AutomationsSchema>

export * from './actions'
export * from './conditions'
export * from './retry'
export * from './template'
export * from './trigger'
