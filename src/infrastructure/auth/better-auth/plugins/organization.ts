/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { organization } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import {
  defaultStatements,
  ownerAc,
  adminAc,
  memberAc,
} from 'better-auth/plugins/organization/access'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Organization plugin configuration type
 */
type PluginOrgConfig = Readonly<{
  teams?:
    | boolean
    | {
        readonly maxTeamsPerOrganization?: number
        readonly allowTeamMetadata?: boolean
        readonly trackActiveTeam?: boolean
      }
  dynamicRoles?:
    | boolean
    | {
        readonly maxRolesPerOrganization?: number
        readonly allowRoleCreation?: readonly ('owner' | 'admin')[]
        readonly allowRoleAssignment?: readonly ('owner' | 'admin')[]
      }
  creatorRole?: string
  allowMultipleOrgs?: boolean
  [key: string]: unknown
}>

/**
 * Build organization plugin configuration
 */
const buildPluginConfig = (
  orgConfig: PluginOrgConfig,
  teamsEnabled: boolean,
  dynamicRolesEnabled: boolean,
  sendInvitationEmail: (data: {
    readonly id: string
    readonly role: string
    readonly email: string
    readonly organization: { readonly name: string }
    readonly invitation: { readonly id: string }
    readonly inviter: { readonly user: { readonly name?: string } }
  }) => Promise<void>
) => {
  const ac = createAccessControl(defaultStatements)
  const roles = {
    owner: ac.newRole({ ...ownerAc.statements }),
    admin: ac.newRole({ ...adminAc.statements }),
    member: ac.newRole({ ...memberAc.statements }),
  }

  return {
    ac,
    roles,
    sendInvitationEmail,
    ...(teamsEnabled && { teams: { enabled: true } }),
    ...(dynamicRolesEnabled && { dynamicRoles: true }),
    ...(orgConfig.creatorRole && { creatorRole: orgConfig.creatorRole }),
    ...(orgConfig.allowMultipleOrgs !== undefined && {
      allowUserToCreateOrganization: orgConfig.allowMultipleOrgs,
    }),
    // NOTE: schema.modelName options removed - drizzleSchema in auth.ts uses standard model names
    // and Drizzle pgTable() definitions specify actual database table names
  }
}

/**
 * Build organization plugin if enabled in auth configuration
 *
 * Includes support for:
 * - Organizations and members
 * - Teams (sub-groups within organizations)
 * - Dynamic access control with role-based permissions
 * - Default roles: owner, admin, member
 */
export const buildOrganizationPlugin = (
  sendInvitationEmail: (data: {
    readonly id: string
    readonly role: string
    readonly email: string
    readonly organization: { readonly name: string }
    readonly invitation: { readonly id: string }
    readonly inviter: { readonly user: { readonly name?: string } }
  }) => Promise<void>,
  authConfig?: Auth
) => {
  if (!authConfig?.organization) return []

  const orgConfig = typeof authConfig.organization === 'boolean' ? {} : authConfig.organization
  const teamsEnabled = !!orgConfig.teams
  const dynamicRolesEnabled = !!orgConfig.dynamicRoles

  const config = buildPluginConfig(
    orgConfig,
    teamsEnabled,
    dynamicRolesEnabled,
    sendInvitationEmail
  )

  return [organization(config)]
}
