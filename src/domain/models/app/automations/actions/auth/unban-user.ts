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
 * Auth Unban User Action (type: auth, operator: unbanUser)
 *
 * Unban a previously banned user account.
 */
export const AuthUnbanUserActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('unbanUser').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotate({ description: 'User ID to unban' })),
  }).annotate({
    description: 'Which user is unbanned.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthUnbanUserAction',
    title: 'Auth Unban User Action',
    description: 'Unban a previously banned user account',
  })
)

/** @public */
export type AuthUnbanUserAction = Schema.Schema.Type<typeof AuthUnbanUserActionSchema>
