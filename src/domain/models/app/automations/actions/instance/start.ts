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
 * Instance start Action (type: instance, operator: start)
 *
 * Starts `sovrium-app@<slug>.socket`. The app itself starts on the first request
 * the socket receives, which is what resumes an app that `stop` suspended.
 */
export const InstanceStartActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('instance').pipe(
    Schema.annotate({
      description: "Constant value 'instance' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('start').pipe(
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
    identifier: 'InstanceStartAction',
    title: 'Instance Start Action',
    description: "Start a supervised app's socket, so the next request wakes the app",
  })
)

/** @public */
export type InstanceStartAction = Schema.Schema.Type<typeof InstanceStartActionSchema>
