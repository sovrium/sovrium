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
  type: Schema.Literal('auth'),
  operator: Schema.Literal('unbanUser'),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotations({ description: 'User ID to unban' })),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AuthUnbanUserAction',
    title: 'Auth Unban User Action',
    description: 'Unban a previously banned user account',
  })
)

/** @public */
export type AuthUnbanUserAction = Schema.Schema.Type<typeof AuthUnbanUserActionSchema>
