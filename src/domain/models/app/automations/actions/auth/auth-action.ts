/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthAddToGroupActionSchema } from './add-to-group'
import { AuthAssignRoleActionSchema } from './assign-role'
import { AuthBanUserActionSchema } from './ban-user'
import { AuthCreateUserActionSchema } from './create-user'
import { AuthDeleteOAuthClientActionSchema } from './delete-oauth-client'
import { AuthRegisterOAuthClientActionSchema } from './register-oauth-client'
import { AuthRemoveFromGroupActionSchema } from './remove-from-group'
import { AuthRotateOAuthClientSecretActionSchema } from './rotate-oauth-client-secret'
import { AuthUnbanUserActionSchema } from './unban-user'

/**
 * Auth Action — union of all authentication operators
 */
export const AuthActionSchema = Schema.Union([
  AuthCreateUserActionSchema,
  AuthAssignRoleActionSchema,
  AuthBanUserActionSchema,
  AuthUnbanUserActionSchema,
  AuthAddToGroupActionSchema,
  AuthRemoveFromGroupActionSchema,
  AuthRegisterOAuthClientActionSchema,
  AuthRotateOAuthClientSecretActionSchema,
  AuthDeleteOAuthClientActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'AuthAction',
    title: 'Auth Action',
    description:
      'Authentication operations (create user, assign role, ban/unban, add to or remove from a group, register, rotate or delete a sign-in client)',
  })
)

/** @public */
export type AuthAction = Schema.Schema.Type<typeof AuthActionSchema>
