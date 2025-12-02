/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Organization Plugin Configuration
 *
 * Enables multi-tenancy with organization management.
 * Users can create organizations, invite members, and manage roles.
 *
 * Configuration options:
 * - maxMembersPerOrg: Maximum members allowed per organization
 * - allowMultipleOrgs: Whether users can belong to multiple organizations
 * - defaultRole: Default role for new members
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { organization: true } }
 *
 * // With configuration
 * { plugins: { organization: { maxMembersPerOrg: 50, allowMultipleOrgs: true } } }
 * ```
 */
export const OrganizationConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    maxMembersPerOrg: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum members per organization' })
      )
    ),
    allowMultipleOrgs: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Allow users to belong to multiple organizations' })
      )
    ),
    defaultRole: Schema.optional(
      Schema.Literal('owner', 'admin', 'member', 'viewer').pipe(
        Schema.annotations({ description: 'Default role for new members' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Organization Plugin Configuration',
    description: 'Multi-tenancy and organization management',
    examples: [true, { maxMembersPerOrg: 50, allowMultipleOrgs: true }],
  })
)

export type OrganizationConfig = Schema.Schema.Type<typeof OrganizationConfigSchema>
