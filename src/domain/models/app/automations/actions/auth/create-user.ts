/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const AuthCreateUserActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth'),
  operator: Schema.Literal('createUser'),
  props: Schema.Struct({
    email: TemplateStringSchema.pipe(Schema.annotations({ description: 'New user email address' })),
    name: TemplateStringSchema.pipe(Schema.annotations({ description: 'New user display name' })),
    password: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Initial password (auto-generated if omitted)' })
      )
    ),
    role: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({ description: 'Role to assign (default: configured defaultRole)' })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AuthCreateUserAction',
    title: 'Auth Create User Action',
    description: 'Create a new user account',
  })
)

export type AuthCreateUserAction = Schema.Schema.Type<typeof AuthCreateUserActionSchema>
