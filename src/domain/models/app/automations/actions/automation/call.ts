/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

export const AutomationCallActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('automation'),
  operator: Schema.Literal('call'),
  props: Schema.Struct({
    name: Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9-]*$/),
      Schema.annotations({
        description:
          'Name of the automation to call (kebab-case, must reference an existing automation)',
      })
    ),

    inputData: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'Key-value pairs passed as input to the called automation (supports template variables)',
        })
      )
    ),

    mode: Schema.optional(
      Schema.Literal('sync', 'async').pipe(
        Schema.annotations({
          description:
            'Execution mode — sync (default, waits for result) or async (fire-and-forget)',
        })
      )
    ),

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

    waitForCompletion: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({
          description:
            'Wait for the called automation to complete (default: true). If false, fire-and-forget.',
        })
      )
    ),

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

export type AutomationCallAction = Schema.Schema.Type<typeof AutomationCallActionSchema>
