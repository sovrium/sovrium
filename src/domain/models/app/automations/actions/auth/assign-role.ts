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
 * Auth Assign Role Action (type: auth, operator: assignRole)
 *
 * Assign a role to an existing user.
 */
export const AuthAssignRoleActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('assignRole').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    userId: TemplateStringSchema.pipe(Schema.annotate({ description: 'Target user ID' })),
    role: TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Role to assign (admin, member, viewer, or custom)' })
    ),
  }).annotate({
    description: 'Which user is given which role.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthAssignRoleAction',
    title: 'Auth Assign Role Action',
    description: 'Assign a role to an existing user',
  })
)

/** @public */
export type AuthAssignRoleAction = Schema.Schema.Type<typeof AuthAssignRoleActionSchema>
