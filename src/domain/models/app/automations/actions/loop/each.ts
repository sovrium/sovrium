/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import type { Action } from '../..'

export const LoopEachActionSchema: Schema.Schema<Action & { readonly type: 'loop' }, unknown> =
  Schema.Struct({
    ...ActionBaseFields,
    type: Schema.Literal('loop'),
    operator: Schema.Literal('each'),
    props: Schema.Struct({
      items: TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Template variable referencing an array (e.g., "{{fetchUsers.response.body.users}}")',
        })
      ),
      actions: Schema.Array(
        Schema.suspend((): Schema.Schema<Action, unknown> => {
          const { ActionSchema } = require('..') as { ActionSchema: Schema.Schema<Action, unknown> }
          return ActionSchema
        })
      ).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description:
            'Actions to execute for each item. Current item: {{loop.item}}, index: {{loop.index}}',
        })
      ),
      maxIterations: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.between(1, 10_000),
          Schema.annotations({
            description: 'Maximum loop iterations (1-10000, default: 1000)',
          })
        )
      ),
      continueOnItemError: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Continue processing remaining items if one fails (default: false)',
          })
        )
      ),
    }),
  }).pipe(
    Schema.annotations({
      identifier: 'LoopEachAction',
      title: 'Loop Each Action',
      description: 'Iterate over an array and execute actions for each item',
    })
  ) as Schema.Schema<Action & { readonly type: 'loop' }, unknown>
