/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { StandardRoleSchema, AdminLevelRoleSchema } from '@/domain/models/app/permissions'

/**
 * Slug Configuration
 *
 * Controls organization slug requirements and validation.
 */
export const SlugConfigSchema = Schema.Struct({
  required: Schema.optional(
    Schema.Boolean.pipe(Schema.annotations({ description: 'Require slug for organizations' }))
  ),
  pattern: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'Regex pattern for slug validation' }))
  ),
  minLength: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Minimum slug length' })
    )
  ),
  maxLength: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Maximum slug length' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Slug Configuration',
    description: 'Organization slug validation rules',
    examples: [{ required: true, minLength: 3, maxLength: 50 }],
  })
)

export type SlugConfig = Schema.Schema.Type<typeof SlugConfigSchema>

/**
 * Dynamic Roles Configuration
 *
 * Enables runtime role creation within organizations.
 * Presence of this config enables dynamic roles feature.
 */
export const DynamicRolesSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    maxRolesPerOrganization: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum custom roles per organization' })
      )
    ),
    allowRoleCreation: Schema.optional(
      Schema.Array(AdminLevelRoleSchema).pipe(
        Schema.annotations({ description: 'Roles that can create custom roles (owner or admin)' })
      )
    ),
    allowRoleAssignment: Schema.optional(
      Schema.Array(AdminLevelRoleSchema).pipe(
        Schema.annotations({ description: 'Roles that can assign custom roles (owner or admin)' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Dynamic Roles',
    description: 'Runtime role creation within organizations',
    examples: [true, { maxRolesPerOrganization: 10, allowRoleCreation: ['owner', 'admin'] }],
  })
)

export type DynamicRoles = Schema.Schema.Type<typeof DynamicRolesSchema>

/**
 * Teams Configuration
 *
 * Enables team management within organizations.
 * Presence of this config enables teams feature.
 */
export const TeamsSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    maxTeamsPerOrganization: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum teams per organization' })
      )
    ),
    allowTeamMetadata: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Allow custom metadata on teams' }))
    ),
    trackActiveTeam: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Track and persist user active team context' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Teams Configuration',
    description: 'Team management within organizations',
    examples: [true, { maxTeamsPerOrganization: 50, trackActiveTeam: true }],
  })
)

export type Teams = Schema.Schema.Type<typeof TeamsSchema>

/**
 * Organization Plugin Configuration
 *
 * Enables multi-tenancy with organization management.
 * Users can create organizations, invite members, and manage roles.
 *
 * Configuration options:
 * - allowMultipleOrgs: Whether users can belong to multiple organizations
 * - defaultRole: Default role for new members
 * - creatorRole: Role assigned to organization creator
 * - allowLeaveOrganization: Allow members to leave
 * - slugConfig: Organization slug configuration
 * - dynamicRoles: Runtime role creation
 * - teams: Team management within organizations
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { organization: true } }
 *
 * // With configuration
 * { plugins: { organization: { allowMultipleOrgs: true, creatorRole: 'owner' } } }
 *
 * // With dynamic roles and teams
 * { plugins: { organization: {
 *   dynamicRoles: { maxRolesPerOrganization: 10 },
 *   teams: { trackActiveTeam: true }
 * } } }
 * ```
 */
export const OrganizationConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    // ========== Core Options ==========
    allowMultipleOrgs: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Allow users to belong to multiple organizations' })
      )
    ),
    defaultRole: Schema.optional(
      StandardRoleSchema.pipe(
        Schema.annotations({
          description: 'Default role for new members (owner, admin, member, or viewer)',
        })
      )
    ),
    creatorRole: Schema.optional(
      AdminLevelRoleSchema.pipe(
        Schema.annotations({
          description: 'Role assigned to organization creator (owner or admin)',
        })
      )
    ),
    allowLeaveOrganization: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Allow members to leave organization' })
      )
    ),
    slugConfig: Schema.optional(SlugConfigSchema),

    // ========== Advanced Features ==========
    dynamicRoles: Schema.optional(DynamicRolesSchema),
    teams: Schema.optional(TeamsSchema),
  })
).pipe(
  Schema.annotations({
    title: 'Organization Plugin Configuration',
    description: 'Multi-tenancy and organization management',
    examples: [
      true,
      { allowMultipleOrgs: true, creatorRole: 'owner' },
      {
        dynamicRoles: true,
        teams: { trackActiveTeam: true },
      },
    ],
  })
)

export type OrganizationConfig = Schema.Schema.Type<typeof OrganizationConfigSchema>
