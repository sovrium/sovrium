/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * State Increment Action (type: state, operator: increment)
 *
 * Atomically increment a numeric value in key-value state.
 * Creates the key with the increment amount if it does not exist.
 */
export const StateIncrementActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('state'),
  operator: Schema.Literal('increment'),
  props: Schema.Struct({
    /** State key to increment */
    key: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'State key to increment (supports template variables)',
      })
    ),

    /** Increment amount (default: 1) */
    amount: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Increment amount (default: 1). Use negative values to decrement.',
        })
      )
    ),

    /** Optional namespace for key isolation */
    namespace: Schema.optional(
      Schema.String.pipe(
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)),
        Schema.annotate({
          description:
            'Namespace for key isolation (lowercase alphanumeric with hyphens, starts with letter)',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'StateIncrementAction',
    title: 'State Increment Action',
    description: 'Atomically increment a numeric value in key-value state',
  })
)

/** @public */
export type StateIncrementAction = Schema.Schema.Type<typeof StateIncrementActionSchema>
