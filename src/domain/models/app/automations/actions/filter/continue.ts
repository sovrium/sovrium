/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'

/**
 * Filter Action (type: filter, operator: continue)
 *
 * Conditionally continue or stop automation based on conditions.
 */
export const FilterContinueActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('filter').pipe(
    Schema.annotate({
      description: "Constant value 'filter' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('continue').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'filter' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    condition: ConditionGroupSchema,
    onFalse: Schema.optional(
      Schema.Literals(['stop', 'skip']).pipe(
        Schema.annotate({
          description:
            'Behavior when condition is false: stop (halt automation) or skip (skip to next action). Default: stop',
        })
      )
    ),
  }).annotate({
    description:
      'The condition the run has to satisfy to carry on, and what happens when it does not.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FilterContinueAction',
    title: 'Filter Continue Action',
    description: 'Conditionally continue or stop automation based on evaluated conditions',
  })
)

/** @public */
export type FilterContinueAction = Schema.Schema.Type<typeof FilterContinueActionSchema>
