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
 * Instance restart Action (type: instance, operator: restart)
 *
 * Stops `sovrium-app@<slug>.socket`, `sovrium-proxy@<slug>.service` and
 * `sovrium-app@<slug>.service` in one call, then starts the socket and the app
 * in one call: a plain restart is cancelled by the proxy's own stop of the app
 * while the proxy runs, and a socket left listening lets a request arriving
 * during the stop wake the app and cancel the stop.
 */
export const InstanceRestartActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('restart').pipe(
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
    identifier: 'InstanceRestartAction',
    title: 'Instance Restart Action',
    description:
      'Restart a supervised app so it reads its current release and environment again: its socket, its proxy and the app stop in one call, then the socket and the app start, so requests arriving meanwhile wait for the new release',
  })
)

/** @public */
export type InstanceRestartAction = Schema.Schema.Type<typeof InstanceRestartActionSchema>
