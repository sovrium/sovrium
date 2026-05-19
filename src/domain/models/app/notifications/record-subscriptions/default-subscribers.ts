/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const DefaultSubscribersSchema = Schema.Struct({
  roles: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Role names to auto-subscribe' })
    )
  ),

  users: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({ description: 'Specific user IDs to auto-subscribe' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'DefaultSubscribers',
    title: 'Default Subscribers',
    description: 'Default subscribers by role or user ID for record change notifications.',
  })
)
