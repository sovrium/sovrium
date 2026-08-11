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
  type: Schema.Literal('filter'),
  operator: Schema.Literal('continue'),
  props: Schema.Struct({
    condition: ConditionGroupSchema,
    onFalse: Schema.optional(
      Schema.Literal('stop', 'skip').pipe(
        Schema.annotations({
          description:
            'Behavior when condition is false: stop (halt automation) or skip (skip to next action). Default: stop',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FilterContinueAction',
    title: 'Filter Continue Action',
    description: 'Conditionally continue or stop automation based on evaluated conditions',
  })
)

/** @public */
export type FilterContinueAction = Schema.Schema.Type<typeof FilterContinueActionSchema>
