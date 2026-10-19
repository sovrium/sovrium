/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Group Name Schema
 *
 * Validates group naming convention: lowercase, alphanumeric, hyphens allowed.
 * Must start with a letter. Same convention as role names.
 *
 * @example
 * ```typescript
 * 'marketing'     // valid
 * 'dev-team'      // valid
 * 'project-alpha' // valid
 * 'Marketing'     // invalid (uppercase)
 * '123team'       // invalid (starts with number)
 * ```
 */
export const GroupNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Group Name',
    description: 'Group identifier. Lowercase alphanumeric with hyphens, must start with a letter.',
    examples: ['marketing', 'dev-team', 'project-alpha'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
)

/**
 * Group Definition Schema
 *
 * Defines a user group for RBAC grouping. Groups complement roles by providing
 * many-to-many user-to-group membership. A user can belong to multiple groups,
 * and permissions can reference groups using the `group:` prefix.
 *
 * Permission resolution follows the most-permissive-wins rule: if a user's role
 * grants `read` and their group grants `update`, the user gets both.
 *
 * @example
 * ```typescript
 * // Minimal group
 * { name: 'marketing' }
 *
 * // Group with description
 * { name: 'finance', description: 'Finance team with access to financial data' }
 *
 * // Group with member limit
 * { name: 'project-alpha', description: 'Cross-functional team', maxMembers: 50 }
 * ```
 */
export const GroupSchema = Schema.Struct({
  /**
   * Unique group identifier.
   *
   * Must be lowercase, alphanumeric with hyphens, starting with a letter.
   * Cannot conflict with built-in or custom role names.
   */
  name: GroupNameSchema,

  /**
   * What the console calls the group (optional). The name stays the identity
   * permissions (`group:<name>`) and the membership write use.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Group Label',
        description:
          'What the console calls this group, in place of its name: the users directory and the Change groups picker show it. The name stays what permissions (`group:<name>`) and the membership write use. Without a label the console shows the name made readable, `equipe-a` reading "Equipe a". A `$t:` key is translated in the operator\'s console language.',
        examples: ['Finance', 'Équipe A'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Human-readable description of the group's purpose (optional). */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Group Description',
        description: 'Human-readable description of the group purpose',
      })
    )
  ),

  /**
   * Maximum number of members allowed in this group (optional).
   *
   * When omitted, the group allows unlimited members.
   * Must be at least 1.
   */
  maxMembers: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        title: 'Max Members',
        description: 'Maximum number of users allowed in this group (min 1, unlimited if omitted)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Group',
    title: 'Group Definition',
    description:
      'User group for RBAC grouping. Groups provide many-to-many user-to-group membership, referenced in permissions with the group: prefix.',
    examples: [
      { name: 'marketing' },
      { name: 'finance', description: 'Finance team with access to financial data' },
      { name: 'project-alpha', description: 'Cross-functional team', maxMembers: 50 },
      { name: 'equipe-a', label: 'Équipe A' },
    ],
  })
)

/** @public */
export type Group = Schema.Schema.Type<typeof GroupSchema>
/** @public */
export type GroupEncoded = Schema.Codec.Encoded<typeof GroupSchema>
