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
 * Auth Create User Action (type: auth, operator: createUser)
 *
 * Create a new user account with email, name, and optional role/password.
 */
export const AuthCreateUserActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('createUser').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'auth' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    email: TemplateStringSchema.pipe(Schema.annotate({ description: 'New user email address' })),
    name: TemplateStringSchema.pipe(Schema.annotate({ description: 'New user display name' })),
    password: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Initial password (auto-generated if omitted)' })
      )
    ),
    role: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({ description: 'Role to assign (default: configured defaultRole)' })
      )
    ),
  }).annotate({
    description: 'The account to create: its email, name, password and role.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AuthCreateUserAction',
    title: 'Auth Create User Action',
    description: 'Create a new user account',
  })
)

/** @public */
export type AuthCreateUserAction = Schema.Schema.Type<typeof AuthCreateUserActionSchema>
