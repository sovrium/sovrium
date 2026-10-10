/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Auth Remove From Group Action (type: auth, operator: removeFromGroup)
 *
 * Remove a user from a group declared in `auth.groups`. Idempotent: removing a
 * user who is not a member succeeds and changes nothing.
 */
export const AuthRemoveFromGroupActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('removeFromGroup').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotate({ description: 'Target user ID' })),
    group: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Name of a group declared in auth.groups. A literal name that is not declared is refused when the app is validated; a templated name is checked when the step runs.',
      })
    ),
  }).annotate({
    description: 'Which user leaves which declared group.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthRemoveFromGroupAction',
    title: 'Auth Remove From Group Action',
    description: 'Remove a user from a declared group; removing a non-member changes nothing',
  })
)

/** @public */
export type AuthRemoveFromGroupAction = Schema.Schema.Type<typeof AuthRemoveFromGroupActionSchema>
