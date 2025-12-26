/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Standard Role Schema
 *
 * The four built-in roles used across the authentication system.
 * These roles have well-defined hierarchies and permissions.
 *
 * Role Hierarchy (highest to lowest):
 * - `owner`: Full control, cannot be removed from organization
 * - `admin`: Can manage members and settings
 * - `member`: Standard access to organization resources
 * - `viewer`: Read-only access
 *
 * @example
 * ```typescript
 * defaultRole: 'member'
 * creatorRole: 'owner'
 * ```
 */
export const StandardRoleSchema = Schema.Literal('owner', 'admin', 'member', 'viewer').pipe(
  Schema.annotations({
    title: 'Standard Role',
    description:
      'Built-in role with predefined permissions. Hierarchy: owner > admin > member > viewer',
    examples: ['owner', 'admin', 'member', 'viewer'],
  })
)

export type StandardRole = Schema.Schema.Type<typeof StandardRoleSchema>

/**
 * Admin-Level Role Schema
 *
 * Subset of roles with administrative capabilities.
 * Used for features like role creation/assignment restrictions.
 */
export const AdminLevelRoleSchema = Schema.Literal('owner', 'admin').pipe(
  Schema.annotations({
    title: 'Admin-Level Role',
    description: 'Roles with administrative capabilities (owner or admin)',
    examples: ['owner', 'admin'],
  })
)

export type AdminLevelRole = Schema.Schema.Type<typeof AdminLevelRoleSchema>

/**
 * User-Level Role Schema
 *
 * Subset of standard roles for default user role assignment.
 * Used in admin plugin for defaultRole configuration.
 */
export const UserLevelRoleSchema = Schema.String.pipe(
  Schema.filter(
    (value): value is 'admin' | 'user' | 'viewer' => {
      return value === 'admin' || value === 'user' || value === 'viewer'
    },
    {
      message: () => 'Invalid role. Must be one of: admin, user, viewer',
    }
  ),
  Schema.annotations({
    title: 'User-Level Role',
    description: 'Roles available for default user assignment in admin context',
    examples: ['admin', 'user', 'viewer'],
  })
)

export type UserLevelRole = Schema.Schema.Type<typeof UserLevelRoleSchema>

/**
 * Flexible Roles Schema
 *
 * Array of role names as strings for table permissions.
 * Allows both standard roles and custom role names.
 *
 * Use this when:
 * - Custom roles are supported (dynamic roles feature)
 * - Role names come from user configuration
 * - Flexibility is more important than strict validation
 *
 * @example
 * ```typescript
 * roles: ['admin', 'editor', 'custom-role']
 * ```
 */
export const FlexibleRolesSchema = Schema.Array(Schema.String).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Flexible Roles',
    description:
      'Array of role names (supports both standard and custom roles). At least one role required.',
    examples: [['admin'], ['admin', 'member'], ['owner', 'admin', 'editor', 'custom-role']],
  })
)

export type FlexibleRoles = Schema.Schema.Type<typeof FlexibleRolesSchema>

/**
 * Standard Roles Array Schema
 *
 * Array of standard roles only (no custom roles).
 * Use for strict validation when only built-in roles are allowed.
 */
export const StandardRolesArraySchema = Schema.Array(StandardRoleSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Standard Roles Array',
    description: 'Array of standard roles only (owner, admin, member, viewer)',
    examples: [['owner'], ['admin', 'member'], ['owner', 'admin', 'member', 'viewer']],
  })
)

export type StandardRolesArray = Schema.Schema.Type<typeof StandardRolesArraySchema>
