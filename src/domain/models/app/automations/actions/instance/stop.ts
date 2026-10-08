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
 * Instance stop Action (type: instance, operator: stop)
 *
 * Stops `sovrium-app@<slug>.socket`, `sovrium-proxy@<slug>.service` and
 * `sovrium-app@<slug>.service` in one call. Stopping the service alone is not a
 * suspend: while its socket is active, the next request starts it again.
 */
export const InstanceStopActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('stop').pipe(
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
    identifier: 'InstanceStopAction',
    title: 'Instance Stop Action',
    description: 'Suspend a supervised app: stop its socket, its proxy and the app',
  })
)

/** @public */
export type InstanceStopAction = Schema.Schema.Type<typeof InstanceStopActionSchema>
