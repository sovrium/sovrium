/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'
import { AiAccessSchema } from '@/domain/models/app/auth/ai-access'
import { PermissionValueSchema } from '@/domain/models/app/auth/permissions'
import { type Action, ActionSchema } from './actions'
import { findReservedStepNames } from './reserved-step-name-validation'
import { RetryConfigSchema } from './retry'
import { type Trigger, TriggerSchema } from './trigger'
import { validateWebhookSignatureScheme } from './trigger/webhook-signature-validation'
import { validateTriggerList } from './trigger-list-validation'
import { TriggerListSchema } from './triggers'

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
 * The fields an automation has whichever way its triggers are declared, before
 * the trigger keys. Shared, with {@link automationTailFields}, by the authored
 * shape ({@link AutomationInputSchema}) and the decoded one
 * ({@link AutomationSchema}); only the two trigger keys differ.
 */
const automationHeadFields = {
  /** Unique automation name (kebab-case, used in webhook URLs) */
  name: Schema.String.pipe(
    Schema.annotate({
      description: 'Unique automation name (kebab-case, e.g., "new-order-notification")',
    }),
    Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(100))
  ),

  /** Human-readable label */
  label: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Human-readable label for this automation' }))
  ),

  /** Description of what this automation does */
  description: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Description of what this automation does' }))
  ),

  /** Whether this automation is enabled (default: true) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true',
        description: 'Whether this automation is active (default: true)',
      })
    )
  ),
}

/** The fields after the trigger keys, in the order the manual lists them. */
const automationTailFields = {
  /** Sequential list of actions to execute */
  actions: Schema.Array(ActionSchema).pipe(
    Schema.annotate({ description: 'Ordered list of actions to execute when triggered' }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Automation-level retry configuration (applies to the entire workflow) */
  retry: Schema.optional(RetryConfigSchema),

  /**
   * Timeout for the entire automation run in milliseconds. Counts only the
   * active execution window: the time a run waits in the concurrency queue or
   * for a human approval is excluded.
   */
  timeout: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Total automation timeout in ms (1000–3600000). Default: 900000 ms of active execution — queue wait and approval suspension are excluded; `SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS` changes the default',
        defaultNote: '900000 (15 minutes), or SOVRIUM_AUTOMATION_DEFAULT_TIMEOUT_MS',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 3_600_000 }))
    )
  ),

  /**
   * Per-automation concurrency control.
   *
   * When set, the scheduler enforces a FIFO cap on simultaneously-running
   * runs of this automation: incoming triggers beyond `limit` are persisted
   * as `'queued'` and promoted to `'running'` as in-flight slots free.
   *
   * Omitted ⇒ the runs of this automation are governed by the global default
   * (`AUTOMATION_CONCURRENCY_DEFAULT` env, falling back to 5). Each automation
   * has an independent semaphore so unrelated workflows never block each
   * other.
   *
   * Single-process scheduler: queueing is in-memory, no DB-coordinated lock
   * across hosts. Designed for Sovrium's single-tenant deployment model.
   */
  concurrency: Schema.optional(
    Schema.Struct({
      limit: Schema.optional(
        Schema.Finite.pipe(
          Schema.annotate({
            description: 'Max simultaneous runs of this automation (1-50)',
          }),
          Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 50 }))
        )
      ),
    }).pipe(
      Schema.annotate({
        identifier: 'AutomationConcurrency',
        description:
          'Per-automation concurrency limits. Without this block, the global default applies.',
      })
    )
  ),

  /** Tags for organization and filtering */
  tags: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({ description: 'Tags for organizing automations' })
    )
  ),

  /** Per-automation permission configuration */
  permissions: Schema.optional(
    Schema.Struct({
      /** Who may start this automation by name, on any road (narrows `requiredRole`, never widens) */
      trigger: Schema.optional(
        PermissionValueSchema.pipe(
          Schema.annotate({
            description:
              "Who may start this automation by name, on any road — the trigger endpoint, the MCP tool and the AI chat: 'all', 'authenticated', or a role array. It narrows the manual trigger's requiredRole and never widens it.",
          })
        )
      ),
    }).pipe(
      Schema.annotate({
        identifier: 'AutomationPermissions',
        description: 'Per-automation permission configuration',
      })
    )
  ),

  /**
   * AI/MCP exposure configuration.
   *
   * Declares this automation as eligible for invocation via Sovrium's MCP
   * server. Only an automation with a manual trigger may set this — record / cron /
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
}

const automationAnnotations = {
  title: 'Automation',
  description:
    'A workflow started by one trigger — or by any of a `triggers` list — that runs a sequence of actions. Data flows between steps via template variables.',
} as const

/**
 * Single Automation Schema — the shape an author writes.
 *
 * An automation declares EITHER `trigger` (one) OR `triggers` (1 to 10), and a
 * sequence of actions. Actions execute sequentially unless a PathAction
 * branches execution.
 *
 * Data flows between steps via template variables:
 * - {{trigger.data.fieldName}} — access trigger payload
 * - {{trigger.type}} / {{trigger.name}} — the trigger that started the run
 * - {{stepName.result}} — access previous step output
 * - $env.VAR_NAME — access environment variable (never logged)
 */
export const AutomationInputSchema = Schema.Struct({
  ...automationHeadFields,
  /** The one trigger that starts this automation — or use `triggers` */
  trigger: Schema.optional(
    TriggerSchema.pipe(
      Schema.annotate({
        description:
          'The one trigger that starts this automation. Declare either `trigger` or `triggers`, never both; `trigger: {…}` means exactly `triggers: [{…}]`.',
      })
    )
  ),
  triggers: Schema.optional(TriggerListSchema),
  ...automationTailFields,
}).pipe(
  Schema.annotate({
    identifier: 'Automation',
    ...automationAnnotations,
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
  Schema.check(
    Schema.makeFilter((automation) => {
      const actionNames = collectActionNames(automation.actions as ReadonlyArray<Action>)
      const uniqueNames = new Set(actionNames)
      if (actionNames.length !== uniqueNames.size) {
        return `Automation '${automation.name}' has duplicate action names`
      }
      // `loop` and `loops` are the template roots of loop items: one issue per
      // step so named, at any depth, each at its own path.
      return findReservedStepNames(automation.actions)
    })
  ),
  Schema.check(Schema.makeFilter((automation) => validateTriggerList(automation)))
)

/**
 * The decoded automation: `triggers` lists every trigger, whichever form the
 * author wrote — the single `trigger` becomes a one-entry list. There is no
 * decoded `trigger`: a consumer that read only it would see the first entry
 * and miss every other, so every consumer reads the list. An entry's name is
 * `triggerEntryName(entry)` (its own `name`, else its type).
 *
 * The manual documents the authored shape ({@link AutomationInputSchema}),
 * where both keys exist.
 */
const AutomationDecodedSchema = Schema.Struct({
  ...automationHeadFields,
  triggers: TriggerListSchema,
  ...automationTailFields,
}).pipe(Schema.annotate(automationAnnotations))

type AutomationDecoded = Schema.Schema.Type<typeof AutomationDecodedSchema>

/** One list, whichever form the author wrote; `validateTriggerList` guarantees one exists. */
const normaliseTriggers = (
  automation: Schema.Schema.Type<typeof AutomationInputSchema>
): AutomationDecoded => {
  const { trigger, triggers, ...rest } = automation
  const list: ReadonlyArray<Trigger> = triggers ?? (trigger === undefined ? [] : [trigger])
  return { ...rest, triggers: list }
}

/** Back to the authored form: one entry is written as `trigger`, more as `triggers`. */
const denormaliseTriggers = (
  automation: AutomationDecoded
): Schema.Schema.Type<typeof AutomationInputSchema> => {
  const { triggers, ...rest } = automation
  const [only] = triggers
  return triggers.length === 1 && only !== undefined
    ? { ...rest, trigger: only }
    : { ...rest, triggers }
}

/**
 * Single Automation Schema — decodes the authored shape
 * ({@link AutomationInputSchema}) into one where `triggers` always lists every
 * trigger.
 */
export const AutomationSchema = AutomationInputSchema.pipe(
  Schema.decodeTo(Schema.toType(AutomationDecodedSchema), {
    decode: SchemaGetter.transform(normaliseTriggers),
    encode: SchemaGetter.transform(denormaliseTriggers),
  }),
  Schema.check(
    Schema.makeFilter((automation) =>
      automation.triggers.reduce<true | string>(
        (verdict, trigger) =>
          verdict === true ? validateWebhookSignatureScheme(automation.name, trigger) : verdict,
        true
      )
    )
  )
)

export type Automation = Schema.Schema.Type<typeof AutomationSchema>
/** @public */
export type AutomationEncoded = Schema.Codec.Encoded<typeof AutomationSchema>

/**
 * Automations Array Schema
 *
 * Top-level array of automations with unique name validation.
 */
export const AutomationsSchema = Schema.Array(AutomationSchema).pipe(
  Schema.annotate({
    identifier: 'Automations',
    title: 'Automations',
    description: 'List of workflow automations with triggers and actions',
  }),
  Schema.check(
    Schema.makeFilter((automations) => {
      const names = automations.map((a) => a.name)
      const uniqueNames = new Set(names)
      return names.length === uniqueNames.size || 'Automation names must be unique'
    })
  )
)

/** @public */
export type Automations = Schema.Schema.Type<typeof AutomationsSchema>

// Re-export all sub-modules
