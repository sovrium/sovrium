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
 * Instance Remove Action (type: instance, operator: remove)
 *
 * Stops the app's socket, proxy and service, as `stop` does. With
 * `purge: true` it then deletes `<SOVRIUM_INSTANCES_DIR>/<slug>` — every
 * release, the env file and `status.json` — which is the host half of erasing
 * an app. The app's database and stored files are not on this host and are not
 * touched here.
 */
export const InstanceRemoveActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('remove').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'instance' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    slug: InstanceSlugSchema,
    purge: Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'true deletes the instance directory (every release, the env file, status.json) after stopping the units; false only stops them',
      })
    ),
  }).annotate({
    description: 'The supervised app to take down, and whether its files go with it.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'InstanceRemoveAction',
    title: 'Instance Remove Action',
    description:
      'Stop a supervised app for good, optionally deleting every release it has on this host',
  })
)

/** @public */
export type InstanceRemoveAction = Schema.Schema.Type<typeof InstanceRemoveActionSchema>
