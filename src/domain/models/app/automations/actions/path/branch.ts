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

/**
 * Path Action (type: path, operator: branch)
 *
 * Split automation into conditional branches (like n8n Switch or Make router).
 * Each path has a condition and its own sequence of actions.
 *
 * Branches are conditional, never concurrent. `first-match` runs the first
 * matching path; `all-matching` runs every matching path sequentially, in
 * declaration order, so a later path observes the effects of an earlier one.
 */
export const PathBranchActionSchema: Schema.Codec<Action & { readonly type: 'path' }, unknown> =
  Schema.Struct({
    ...ActionBaseFields,
    type: Schema.Literal('path').pipe(
      Schema.annotate({
        description: "Constant value 'path' for type discrimination in discriminated unions",
      })
    ),
    operator: Schema.Literal('branch').pipe(
      Schema.annotate({
        description:
          "Selects the operation within the 'path' action family; it decides which props the step takes",
      })
    ),
    props: Schema.Struct({
      paths: Schema.Array(
        Schema.Struct({
          name: Schema.String.pipe(
            Schema.annotate({ description: 'Path name for identification' }),
            Schema.check(Schema.isMinLength(1))
          ),
          condition: Schema.optional(ConditionGroupSchema),
          actions: Schema.Array(
            Schema.suspend((): Schema.Codec<Action, unknown> => {
              // `require`, not a static import read lazily: a static import
              // closes the cycle branch → action-union → path → path-action →
              // branch, and evaluating this module or the `path` barrel before
              // the union then throws a temporal-dead-zone ReferenceError (see
              // `actions/loop/each.ts`, where it was measured). `'..'` is
              // `actions/index.ts` (the top-level ActionSchema union); `'.'`
              // would be `actions/path/index.ts`, which has no ActionSchema.
              // Schema.suspend defers the lookup to decode time.
              // eslint-disable-next-line @typescript-eslint/no-require-imports -- a deferred require is what breaks the import cycle with the ActionSchema union, as above
              const { ActionSchema } = require('..') as {
                ActionSchema: Schema.Codec<Action, unknown>
              }
              return ActionSchema
            })
          ).pipe(
            Schema.annotate({
              description:
                'Actions to execute on this path. May be empty: a path with no actions does nothing, and under first-match it still claims the run, so no later path runs',
            })
          ),
        })
      ).pipe(
        Schema.annotate({ description: 'Two or more paths to branch into' }),
        Schema.check(Schema.isMinLength(2))
      ),
      mode: Schema.optional(
        Schema.Literals(['first-match', 'all-matching']).pipe(
          Schema.annotate({
            description:
              'first-match: execute only the first matching path; all-matching: execute every matching path sequentially, in declaration order. Default: first-match',
          })
        )
      ),
    }).annotate({
      description: 'The branches to consider, and whether one or all of the matching ones run.',
    }),
  }).pipe(
    Schema.annotate({
      identifier: 'PathBranchAction',
      title: 'Path Branch Action',
      description:
        'Split automation into conditional branches, executed sequentially in declaration order',
    })
  ) as Schema.Codec<Action & { readonly type: 'path' }, unknown>
