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
 * Instance status Action (type: instance, operator: status)
 *
 * Reads `systemctl show` for `sovrium-app@<slug>.service` (ActiveState, SubState,
 * MainPID, NRestarts, MemoryCurrent, Result, ExecMainStatus, InvocationID) and the
 * revision `current` points at. Writes nothing.
 */
export const InstanceStatusActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('status').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
  }).annotate({
    description: 'The supervised app the step acts on.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceStatusAction',
    title: 'Instance Status Action',
    description:
      "Read a supervised app's unit state, restart count, memory use, how its last run ended and current revision",
  })
)

/** @public */
export type InstanceStatusAction = Schema.Schema.Type<typeof InstanceStatusActionSchema>
