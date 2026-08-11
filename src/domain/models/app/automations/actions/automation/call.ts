/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Automation Call Action (type: automation, operator: call)
 *
 * Invoke another automation as a step in the current workflow.
 * Enables composable, DRY automation architectures.
 *
 * The referenced automation name is validated against app.automations[]
 * in the AppSchema cross-validation layer.
 */
export const AutomationCallActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('automation'),
  operator: Schema.Literal('call'),
  props: Schema.Struct({
    /** Name of the automation to invoke (must exist in app.automations[]) */
    name: Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9-]*$/),
      Schema.annotations({
        description:
          'Name of the automation to call (kebab-case, must reference an existing automation)',
      })
    ),

    /** Input data passed to the called automation */
    inputData: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Key-value pairs passed as input to the called automation (supports template variables)',
        })
      )
    ),

    /**
     * Execution mode: `sync` (default) waits for the called automation to
     * complete and captures its return data as `steps.{name}.result`;
     * `async` fires the child and immediately continues to the next action.
     */
    mode: Schema.optional(
      Schema.Literal('sync', 'async').pipe(
        Schema.annotations({
          description:
            'Execution mode — sync (default, waits for result) or async (fire-and-forget)',
        })
      )
    ),

    /**
     * Maximum call-stack depth before the action fails with a recursion
     * error (default: 10). Guards against infinite A→B→A chains.
     */
    maxDepth: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 100),
        Schema.annotations({
          description:
            'Maximum call depth before failing with a recursion error (1-100, default 10)',
        })
      )
    ),

    /** Whether to wait for the called automation to complete */
    waitForCompletion: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({
          description:
            'Wait for the called automation to complete (default: true). If false, fire-and-forget.',
        })
      )
    ),

    /** Timeout for the called automation in milliseconds */
    timeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1000, 900_000),
        Schema.annotations({
          description: 'Timeout in ms for the called automation (1000-900000)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AutomationCallAction',
    title: 'Automation Call Action',
    description: 'Invoke another automation as a step. Enables composable workflow architectures.',
  })
)

/** @public */
export type AutomationCallAction = Schema.Schema.Type<typeof AutomationCallActionSchema>
