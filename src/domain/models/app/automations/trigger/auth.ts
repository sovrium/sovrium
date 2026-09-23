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
  type: Schema.Literal('auth').pipe(
    Schema.annotate({
      description: "Constant value 'auth' for type discrimination in discriminated unions",
    })
  ),
  events: Schema.Array(
    Schema.Literals(['signUp', 'signIn', 'signOut', 'passwordReset', 'emailVerified'])
  ).pipe(
    Schema.annotate({ description: 'Authentication events that trigger this automation' }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AuthTrigger',
    title: 'Auth Trigger',
    description: 'Trigger automation on authentication events (sign-up, sign-in, etc.)',
  })
)

/** @public */
export type AuthTrigger = Schema.Schema.Type<typeof AuthTriggerSchema>
