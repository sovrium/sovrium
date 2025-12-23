/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { StandardRoleSchema, AdminLevelRoleSchema } from '@/domain/models/app/permissions'

/**
 * Member Limits Configuration
 *
 * Controls maximum members per organization and how limits are calculated.
 * Presence of this config enables member limit enforcement.
 */
export const MemberLimitsSchema = Schema.Union(
  // Simple form: just a number
  Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({ description: 'Maximum members per organization (simple form)' })
  ),
  // Detailed form: object with options
  Schema.Struct({
    perOrganization: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum members per organization' })
      )
    ),
    countPendingInvitations: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Count pending invitations toward member limit' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Member Limits',
    description: 'Member limit enforcement configuration',
    examples: [50, { perOrganization: 50, countPendingInvitations: true }],
  })
)

export type MemberLimits = Schema.Schema.Type<typeof MemberLimitsSchema>

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
 * - maxMembersPerOrg: Maximum members allowed per organization (legacy, use memberLimits)
 * - allowMultipleOrgs: Whether users can belong to multiple organizations
 * - defaultRole: Default role for new members
 * - memberLimits: Advanced member limit configuration
 * - allowedDomains: Email domains allowed to join
 * - creatorRole: Role assigned to organization creator
 * - invitationExpiry: Invitation expiry time in milliseconds
 * - allowLeaveOrganization: Allow members to leave
 * - metadata: Custom metadata fields for organizations
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
 * { plugins: { organization: { maxMembersPerOrg: 50, allowMultipleOrgs: true } } }
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
    // ========== Existing Fields ==========
    maxMembersPerOrg: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Maximum members per organization (legacy)' })
      )
    ),
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

    // ========== Organization Options ==========
    memberLimits: Schema.optional(MemberLimitsSchema),
    allowedDomains: Schema.optional(
      Schema.Array(Schema.String).pipe(
        Schema.annotations({
          description: 'Email domains allowed to join organization (e.g., ["example.com"])',
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
    invitationExpiry: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Invitation expiry time in milliseconds' })
      )
    ),
    allowLeaveOrganization: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotations({ description: 'Allow members to leave organization' })
      )
    ),
    metadata: Schema.optional(
      Schema.Record({
        key: Schema.String,
        value: Schema.Unknown,
      }).pipe(Schema.annotations({ description: 'Custom metadata schema for organizations' }))
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
      { maxMembersPerOrg: 50, allowMultipleOrgs: true },
      {
        memberLimits: { perOrganization: 100, countPendingInvitations: true },
        dynamicRoles: true,
        teams: { trackActiveTeam: true },
      },
    ],
  })
)

export type OrganizationConfig = Schema.Schema.Type<typeof OrganizationConfigSchema>
