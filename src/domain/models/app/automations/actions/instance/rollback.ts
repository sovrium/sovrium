/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { InstanceSlugSchema } from './instance-slug'

/**
 * Instance Rollback Action (type: instance, operator: rollback)
 *
 * Points `current` back at the release `status.json` records as the previous
 * one, records the swap — each release keeps its own `appliedAt`, the swap is
 * dated `rolledBackAt` — and restarts the app as `restart` does. Fails,
 * changing nothing, when no previous release is recorded or its directory is
 * gone. Rolling back twice returns to where it started.
 */
export const InstanceRollbackActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('rollback').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
  }).annotate({
    description: 'The supervised app whose previous release is restored.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceRollbackAction',
    title: 'Instance Rollback Action',
    description: 'Point a supervised app back at its previous release and restart it',
  })
)

/** @public */
export type InstanceRollbackAction = Schema.Schema.Type<typeof InstanceRollbackActionSchema>
