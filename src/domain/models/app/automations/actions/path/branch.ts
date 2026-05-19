/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConditionGroupSchema } from '../../conditions'
import { ActionBaseFields } from '../base'
import type { Action } from '../..'

export const PathBranchActionSchema: Schema.Schema<Action & { readonly type: 'path' }, unknown> =
  Schema.Struct({
    ...ActionBaseFields,
    type: Schema.Literal('path'),
    operator: Schema.Literal('branch'),
    props: Schema.Struct({
      paths: Schema.Array(
        Schema.Struct({
          name: Schema.String.pipe(
            Schema.minLength(1),
            Schema.annotations({ description: 'Path name for identification' })
          ),
          condition: Schema.optional(ConditionGroupSchema),
          actions: Schema.Array(
            Schema.suspend((): Schema.Schema<Action, unknown> => {
              const { ActionSchema } = require('..') as {
                ActionSchema: Schema.Schema<Action, unknown>
              }
              return ActionSchema
            })
          ).pipe(
            Schema.minItems(1),
            Schema.annotations({ description: 'Actions to execute on this path' })
          ),
        })
      ).pipe(
        Schema.minItems(2),
        Schema.annotations({ description: 'Two or more paths to branch into' })
      ),
      mode: Schema.optional(
        Schema.Literal('first-match', 'all-matching').pipe(
          Schema.annotations({
            description:
              'first-match: execute first matching path; all-matching: execute all matching in parallel. Default: first-match',
          })
        )
      ),
    }),
  }).pipe(
    Schema.annotations({
      identifier: 'PathBranchAction',
      title: 'Path Branch Action',
      description: 'Split automation into conditional parallel branches',
    })
  ) as Schema.Schema<Action & { readonly type: 'path' }, unknown>
