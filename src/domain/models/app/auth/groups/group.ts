/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const GroupNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.annotations({
    title: 'Group Name',
    description: 'Group identifier. Lowercase alphanumeric with hyphens, must start with a letter.',
    examples: ['marketing', 'dev-team', 'project-alpha'],
  })
)

export const GroupSchema = Schema.Struct({
  name: GroupNameSchema,

  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        title: 'Group Description',
        description: 'Human-readable description of the group purpose',
      })
    )
  ),

  maxMembers: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.annotations({
        title: 'Max Members',
        description: 'Maximum number of users allowed in this group (min 1, unlimited if omitted)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Group',
    title: 'Group Definition',
    description:
      'User group for RBAC grouping. Groups provide many-to-many user-to-group membership, referenced in permissions with the group: prefix.',
    examples: [
      { name: 'marketing' },
      { name: 'finance', description: 'Finance team with access to financial data' },
      { name: 'project-alpha', description: 'Cross-functional team', maxMembers: 50 },
    ],
  })
)

export type Group = Schema.Schema.Type<typeof GroupSchema>
export type GroupEncoded = Schema.Schema.Encoded<typeof GroupSchema>
