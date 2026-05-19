/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RetryConfigSchema } from '../retry'

export const ActionBaseFields = {
  name: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    Schema.annotations({
      description:
        'Step name for referencing outputs (e.g., "fetchUser"). Must be alphanumeric + underscore.',
    })
  ),

  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable label for this action step' })
    )
  ),

  retry: Schema.optional(RetryConfigSchema),

  continueOnError: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Continue workflow even if this action fails (default: false)',
      })
    )
  ),

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
