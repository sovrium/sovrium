/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const AuthAssignRoleActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth'),
  operator: Schema.Literal('assignRole'),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotations({ description: 'Target user ID' })),
    role: TemplateStringSchema.pipe(
      Schema.annotations({ description: 'Role to assign (admin, member, viewer, or custom)' })
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AuthAssignRoleAction',
    title: 'Auth Assign Role Action',
    description: 'Assign a role to an existing user',
  })
)

export type AuthAssignRoleAction = Schema.Schema.Type<typeof AuthAssignRoleActionSchema>
