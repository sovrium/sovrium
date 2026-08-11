/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Auth Trigger
 *
 * Triggered by authentication events.
 */
export const AuthTriggerSchema = Schema.Struct({
  type: Schema.Literal('auth'),
  events: Schema.Array(
    Schema.Literal('signUp', 'signIn', 'signOut', 'passwordReset', 'emailVerified')
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Authentication events that trigger this automation' })
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AuthTrigger',
    title: 'Auth Trigger',
    description: 'Trigger automation on authentication events (sign-up, sign-in, etc.)',
  })
)

/** @public */
export type AuthTrigger = Schema.Schema.Type<typeof AuthTriggerSchema>
