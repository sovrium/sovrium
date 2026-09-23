/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RetryConfigSchema } from '../retry'

/**
 * Base fields shared by all action types (at top level, NOT in props)
 */
export const ActionBaseFields = {
  /** Unique step name within the automation (used for template variable references) */
  name: Schema.String.pipe(
    Schema.annotate({
      description:
        'Step name for referencing outputs (e.g., "fetchUser"). Must be alphanumeric + underscore.',
    }),
    Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]*$/))
  ),

  /** Human-readable label (optional) */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Human-readable label for this action step' })
    )
  ),

  /** Per-action retry config (overrides automation-level retry) */
  retry: Schema.optional(RetryConfigSchema),

  /** Continue execution even if this action fails */
  continueOnError: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description: 'Continue workflow even if this action fails (default: false)',
      })
    )
  ),

  /**
   * Per-action timeout (ms). When the action's execution exceeds this
   * duration the engine cancels it and the step records `status: 'failure'`
   * with an `error` describing the timeout. Distinct from any action-type
   * specific `props.timeout` (e.g. `code.props.timeout` for the sandbox
   * race) — this top-level field is enforced uniformly by the run loop
   * for ALL action types (delay, http, code, …).
   *
   * Range matches `automation.timeout`: 1_000 – 900_000 ms.
   */
  timeout: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Per-action timeout in ms (1000-900000). Terminates the action when exceeded.',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 900_000 }))
    )
  ),
}

/**
 * The base fields as a schema, so the manual can walk them.
 *
 * `ActionBaseFields` is a field BAG that every action type spreads into its
 * own struct; a documentation directive needs a schema node to address, and
 * this is that node. Nothing decodes through it — an action is decoded by its
 * own variant — so it adds no behaviour, only a name for the shared half.
 */
export const ActionBaseSchema = Schema.Struct(ActionBaseFields)
