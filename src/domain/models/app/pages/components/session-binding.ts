/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const SessionFieldSchema = Schema.Literal('email', 'name', 'role', 'id').annotations({
  identifier: 'SessionField',
  title: 'Session Field',
  description:
    "A field of the signed-in caller's OWN session (email/name/role/id), resolved client-side from GET /api/auth/get-session. Also the <field> of the $session.<field> interpolation token.",
})

export const sessionFields = {
  session: Schema.optional(
    SessionFieldSchema.annotations({
      description:
        "Render the signed-in caller's OWN session field (email/name/role/id), resolved client-side from GET /api/auth/get-session. Generic: any app showing 'logged in as X'. Renders nothing for anonymous callers.",
    })
  ),
} as const

export type SessionField = Schema.Schema.Type<typeof SessionFieldSchema>
