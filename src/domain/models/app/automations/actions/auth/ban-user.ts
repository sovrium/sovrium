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
 * Auth Ban User Action (type: auth, operator: banUser)
 *
 * Ban a user account with optional reason.
 */
export const AuthBanUserActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('banUser').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotate({ description: 'User ID to ban' })),
    reason: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Ban reason (stored for audit trail)' })
      )
    ),
  }).annotate({
    description: 'Which user is banned, and the reason recorded.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthBanUserAction',
    title: 'Auth Ban User Action',
    description: 'Ban a user account',
  })
)

/** @public */
export type AuthBanUserAction = Schema.Schema.Type<typeof AuthBanUserActionSchema>
