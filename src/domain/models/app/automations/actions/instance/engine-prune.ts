/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { INSTANCE_ENGINE_VERSION_PATTERN } from './engine-install'
import { wholeTemplate } from './instance-slug'

const KeepSchema = Schema.Union([
  Schema.Array(
    Schema.String.annotate({
      description: 'A release number to keep, <major>.<minor>.<patch>',
    }).check(Schema.isPattern(INSTANCE_ENGINE_VERSION_PATTERN))
  ),
  wholeTemplate('One whole {{template}} resolving to a list of release numbers'),
]).annotate({
  description:
    'Versions to keep whatever links them. An empty list keeps only the versions some release still links',
})

/**
 * Instance Engine Prune Action (type: instance, operator: enginePrune)
 *
 * Removes from the engine store every version that is neither listed in
 * `keep` nor linked by any supervised app's current release or by the
 * previous release its `status.json` records — the two a rollback can reach.
 * Returns the versions it removed and the ones it kept.
 */
export const InstanceEnginePruneActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('enginePrune').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    keep: KeepSchema,
  }).annotate({
    description: 'The engine versions to keep in the store besides the ones a release links.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceEnginePruneAction',
    title: 'Instance Engine Prune Action',
    description:
      'Remove the engine versions no current or previous release links and that are not listed to keep',
  })
)

/** @public */
export type InstanceEnginePruneAction = Schema.Schema.Type<typeof InstanceEnginePruneActionSchema>
