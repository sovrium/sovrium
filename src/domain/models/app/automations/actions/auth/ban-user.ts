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
  type: Schema.Literal('auth'),
  operator: Schema.Literal('banUser'),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotations({ description: 'User ID to ban' })),
    reason: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Ban reason (stored for audit trail)' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AuthBanUserAction',
    title: 'Auth Ban User Action',
    description: 'Ban a user account',
  })
)

/** @public */
export type AuthBanUserAction = Schema.Schema.Type<typeof AuthBanUserActionSchema>
