/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthAssignRoleActionSchema } from './assign-role'
import { AuthBanUserActionSchema } from './ban-user'
import { AuthCreateUserActionSchema } from './create-user'
import { AuthUnbanUserActionSchema } from './unban-user'

/**
 * Auth Action — union of all authentication operators
 */
export const AuthActionSchema = Schema.Union(
  AuthCreateUserActionSchema,
  AuthAssignRoleActionSchema,
  AuthBanUserActionSchema,
  AuthUnbanUserActionSchema
).pipe(
  Schema.annotations({
    identifier: 'AuthAction',
    title: 'Auth Action',
    description: 'Authentication operations (create user, assign role, ban/unban)',
  })
)

/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>

export * from './assign-role'
export * from './ban-user'
export * from './create-user'
export * from './unban-user'
