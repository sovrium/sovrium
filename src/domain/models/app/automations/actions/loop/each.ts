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

/**
 * Loop Action (type: loop, operator: each)
 *
 * Iterate over an array and execute actions for each item.
 * Current item available as {{loop.item}}, index as {{loop.index}}.
 */
export const LoopEachActionSchema: Schema.Codec<Action & { readonly type: 'loop' }, unknown> =
  Schema.Struct({
    ...ActionBaseFields,
    type: Schema.Literal('loop').pipe(
      Schema.annotate({
        description: "Constant value 'loop' for type discrimination in discriminated unions",
      })
    ),
    operator: Schema.Literal('each').pipe(
      Schema.annotate({
        description:
          "Selects the operation within the 'loop' action family; it decides which props the step takes",
      })
    ),
    props: Schema.Struct({
      items: TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Template variable referencing an array (e.g., "{{fetchUsers.response.body.users}}")',
        })
      ),
      actions: Schema.Array(
        Schema.suspend((): Schema.Codec<Action, unknown> => {
          // Why `require` and not a static `import { ActionSchema }` read
          // lazily here: the static import puts this module in a cycle
          // (each → action-union → loop → loop-action → each), and whenever
          // this module or the `loop` barrel is evaluated BEFORE the union,
          // `loop-action.ts` reads `LoopEachActionSchema` while it is still in
          // its temporal dead zone and the import throws a ReferenceError.
          // Measured: a direct `import('./each')` threw, and so did the
          // `loop/` and `path/` unit tests. `require` keeps the edge out of
          // the static graph. `'..'` is `actions/index.ts` (the top-level
          // ActionSchema union); `'.'` would be `actions/loop/index.ts`,
          // which has no ActionSchema. Same in `actions/path/branch.ts`.
          // Both surfaced when a spec first exercised a recursive action shape.
          // eslint-disable-next-line @typescript-eslint/no-require-imports -- a deferred require is what breaks the import cycle with the ActionSchema union, as above
          const { ActionSchema } = require('..') as { ActionSchema: Schema.Codec<Action, unknown> }
          return ActionSchema
        })
      ).pipe(
        Schema.annotate({
          description:
            'Actions to execute for each item. Current item: {{loop.item}}, index: {{loop.index}}',
        }),
        Schema.check(Schema.isMinLength(1))
      ),
      maxIterations: Schema.optional(
        Schema.Finite.pipe(
          Schema.annotate({
            howTo:
              'The cap truncates silently: a loop over 1,800 entries processes the first 1,000 and still reports success. Raise it explicitly whenever the list can exceed the cap, or page the source and loop per page.',
            defaultNote: '1000',
            description: 'Maximum loop iterations (1-10000, default: 1000)',
          }),
          Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10_000 }))
        )
      ),
      continueOnItemError: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotate({
            defaultNote: 'false',
            description: 'Continue processing remaining items if one fails (default: false)',
          })
        )
      ),
    }).annotate({
      description: 'The list to walk, the actions run for each entry, and the limits on the walk.',
    }),
  }).pipe(
    Schema.annotate({
      identifier: 'LoopEachAction',
      title: 'Loop Each Action',
      description: 'Iterate over an array and execute actions for each item',
    })
  ) as Schema.Codec<Action & { readonly type: 'loop' }, unknown>
