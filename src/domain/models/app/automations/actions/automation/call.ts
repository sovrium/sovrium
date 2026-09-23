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
  type: Schema.Literal('automation').pipe(
    Schema.annotate({
      description: "Constant value 'automation' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('call').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'automation' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Name of the automation to invoke (must exist in app.automations[]) */
    name: Schema.String.pipe(
      Schema.annotate({
        description:
          'Name of the automation to call (kebab-case, must reference an existing automation)',
      }),
      Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
    ),

    /** Input data passed to the called automation */
    inputData: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
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
      Schema.Literals(['sync', 'async']).pipe(
        Schema.annotate({
          howTo:
            '`sync` waits for the called automation to finish before the next step runs; `async` starts it and moves on. `waitForCompletion` is accepted but never read, so use this instead.',
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
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '10',
          description:
            'Maximum call depth before failing with a recursion error (1-100, default 10)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
      )
    ),

    /**
     * ACCEPTED AND NEVER READ. The handler decides sync-vs-async from the
     * `mode` property alone; this key reaches no read site, so a call written
     * with `waitForCompletion: false` still waits. Kept because removing it
     * would break configs that already carry it.
     */
    waitForCompletion: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            'Accepted for compatibility and NOT read at runtime — choose sync or async with the mode property. A call setting only this key still runs synchronously.',
        })
      )
    ),

    /** ACCEPTED AND NEVER READ, like `waitForCompletion` above. */
    timeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description:
            'Accepted for compatibility and NOT read at runtime (1000-900000). Bound the step with the action-level timeout instead.',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 900_000 }))
      )
    ),
  }).annotate({
    description: 'Which automation to run, what to hand it, and whether to wait for it to finish.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AutomationCallAction',
    title: 'Automation Call Action',
    description: 'Invoke another automation as a step. Enables composable workflow architectures.',
  })
)

/** @public */
export type AutomationCallAction = Schema.Schema.Type<typeof AutomationCallActionSchema>
