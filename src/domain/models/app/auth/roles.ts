/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Built-in Role Names
 *
 * These roles are always available without configuration.
 * They cannot be redefined by custom role definitions.
 *
 * Hierarchy (highest to lowest):
 * - admin (80): Can manage members and settings
 * - member (40): Standard access to organization resources
 * - viewer (10): Read-only access
 */
export const BUILT_IN_ROLES = ['admin', 'member', 'viewer'] as const

export const BUILT_IN_ROLE_LEVELS: Readonly<Record<string, number>> = {
  admin: 80,
  member: 40,
  viewer: 10,
}

/**
 * Built-in Role Schema
 *
 * The three built-in roles with predefined hierarchy levels.
 */
export const BuiltInRoleSchema = Schema.Literal('admin', 'member', 'viewer').pipe(
  Schema.annotations({
    title: 'Built-in Role',
    description: 'Built-in role with predefined hierarchy. Levels: admin=80, member=40, viewer=10',
    examples: ['admin', 'member', 'viewer'],
  })
)

export type BuiltInRole = Schema.Schema.Type<typeof BuiltInRoleSchema>

/**
 * Role Name Schema
 *
 * Validates role naming convention: lowercase, alphanumeric, hyphens allowed.
 * Must start with a letter.
 *
 * @example
 * ```typescript
 * 'editor'          // valid
 * 'content-manager' // valid
 * 'Editor'          // invalid (uppercase)
 * '123role'         // invalid (starts with number)
 * ```
 */
export const RoleNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.annotations({
    title: 'Role Name',
    description: 'Role name: lowercase, alphanumeric, hyphens. Must start with a letter.',
    examples: ['editor', 'content-manager', 'moderator'],
  })
)

export type RoleName = Schema.Schema.Type<typeof RoleNameSchema>

/**
 * Custom Role Definition Schema
 *
 * Defines a custom role with an optional description and hierarchy level.
 *
 * @example
 * ```typescript
 * { name: 'editor', description: 'Can edit content', level: 30 }
 * { name: 'moderator' }
 * ```
 */
export const RoleDefinitionSchema = Schema.Struct({
  name: RoleNameSchema,
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Human-readable description of the role' })
    )
  ),
  level: Schema.optional(
    Schema.Number.pipe(
      Schema.annotations({
        description:
          'Hierarchy level (higher = more permissions). Built-in: admin=80, member=40, viewer=10',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Role Definition',
    description:
      'Custom role definition with name, optional description, and optional hierarchy level.',
    examples: [
      { name: 'editor', description: 'Can edit content', level: 30 },
      { name: 'moderator', level: 20 },
      { name: 'contributor' },
    ],
  })
)

export type RoleDefinition = Schema.Schema.Type<typeof RoleDefinitionSchema>

/**
 * Roles Config Schema
 *
 * Array of custom role definitions. Empty array is valid (only built-in roles).
 *
 * Validates:
 * - Role names are unique
 * - Custom role names don't conflict with built-in role names
 *
 * @example
 * ```typescript
 * []  // valid: only built-in roles
 * [{ name: 'editor', level: 30 }, { name: 'moderator', level: 20 }]
 * ```
 */
export const RolesConfigSchema = Schema.Array(RoleDefinitionSchema).pipe(
  Schema.filter((roles) => {
    // Check for duplicate names
    const names = roles.map((r) => r.name)
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      return `Duplicate role names: ${duplicates.join(', ')}`
    }

    // Check for conflicts with built-in roles
    const conflicts = names.filter((name) => (BUILT_IN_ROLES as readonly string[]).includes(name))
    if (conflicts.length > 0) {
      return `Custom role names cannot conflict with built-in roles: ${conflicts.join(', ')}`
    }

    return undefined
  }),
  Schema.annotations({
    title: 'Roles Configuration',
    description: 'Array of custom role definitions. Built-in roles are always available.',
    examples: [
      [],
      [
        { name: 'editor', description: 'Can edit content', level: 30 },
        { name: 'moderator', level: 20 },
      ],
    ],
  })
)

export type RolesConfig = Schema.Schema.Type<typeof RolesConfigSchema>

/**
 * Default Role Schema
 *
 * Accepts built-in roles and custom role names.
 * Defaults to 'member' when not specified.
 *
 * @example
 * ```typescript
 * 'viewer'   // built-in role
 * 'editor'   // custom role (must be defined in auth.roles)
 * ```
 */
export const DefaultRoleSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Default Role',
    description:
      'Role assigned to new users by default. Accepts built-in roles or custom role names. Defaults to member.',
    examples: ['member', 'viewer', 'editor'],
  })
)

export type DefaultRole = Schema.Schema.Type<typeof DefaultRoleSchema>
