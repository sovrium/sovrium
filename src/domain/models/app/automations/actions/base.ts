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
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    Schema.annotations({
      description:
        'Step name for referencing outputs (e.g., "fetchUser"). Must be alphanumeric + underscore.',
    })
  ),

  /** Human-readable label (optional) */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this action step' })
    )
  ),

  /** Per-action retry config (overrides automation-level retry) */
  retry: Schema.optional(RetryConfigSchema),

  /** Continue execution even if this action fails */
  continueOnError: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
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
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1000, 900_000),
      Schema.annotations({
        description: 'Per-action timeout in ms (1000-900000). Terminates the action when exceeded.',
      })
    )
  ),
}
