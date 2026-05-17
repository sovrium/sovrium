/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

/** @public */
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

/** @public */
export type RoleName = Schema.Schema.Type<typeof RoleNameSchema>

/**
 * `$currentUser.assignments.<table>[0]` interpolation token pattern.
 *
 * Used in `defaultLanding` URLs to substitute the first record ID from a
 * user's `user_access` rows for a given scope table. The `<table>` segment
 * matches the slug pattern enforced by `auth.scopeTables`.
 */
const ASSIGNMENT_TOKEN_PATTERN = /\$currentUser\.assignments\.[a-z][a-z0-9_-]*\[0\]/g

const validateLandingUrlTokens = (
  fieldName: 'defaultLanding' | 'pickerLanding',
  value: string,
  options: Readonly<{ allowToken: boolean; requireToken: boolean }>
): string | undefined => {
  const matches = value.match(ASSIGNMENT_TOKEN_PATTERN) ?? []
  if (!options.allowToken && matches.length > 0) {
    return `${fieldName} must not contain a $currentUser.assignments.<table>[0] token (the multi-record case has no single ID to substitute)`
  }
  if (matches.length > 1) {
    return `${fieldName} may contain at most one $currentUser.assignments.<table>[0] token, found ${matches.length}`
  }
  if (options.requireToken && matches.length === 0) {
    return `${fieldName} must contain a $currentUser.assignments.<table>[0] token`
  }
  return undefined
}

/**
 * Default Landing URL Schema
 *
 * Per-role landing URL evaluated when a session navigates to
 * `auth.landingPath`. Resolved at session-establish time by walking
 * `auth.roles[]` in declaration order and selecting the first role whose
 * `defaultLanding` matches the user's session shape.
 *
 * Supports a single `$currentUser.assignments.<table>[0]` interpolation
 * token. Token presence vs absence drives engine resolution:
 *
 * - **No token** (e.g., `/admin`): unconditional redirect for users with
 *   this role.
 * - **One token** (e.g., `/portal/clients/$currentUser.assignments.clients[0]`):
 *   single-record landing. Engine substitutes the first assignment ID for
 *   `<table>` when the user has exactly one assignment in that scope.
 *   Multi-record case is handled by the role's optional `pickerLanding`.
 *
 * Two or more tokens are rejected (the resolver cannot infer which scope
 * table to count).
 *
 * @example
 * ```yaml
 * defaultLanding: /admin
 * defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
 * ```
 */
export const DefaultLandingSchema = Schema.String.pipe(
  Schema.pattern(/^\//),
  Schema.filter((value) =>
    validateLandingUrlTokens('defaultLanding', value, { allowToken: true, requireToken: false })
  ),
  Schema.annotations({
    title: 'Default Landing URL',
    description:
      'Per-role landing URL evaluated when a session navigates to auth.landingPath. Must start with /. Supports at most one $currentUser.assignments.<table>[0] token. Token presence selects single-record landing; absence is unconditional.',
    examples: ['/admin', '/portal/clients/$currentUser.assignments.clients[0]', '/dashboard'],
  })
)

/**
 * Picker Landing URL Schema
 *
 * Multi-record fallback for a role whose `defaultLanding` contains a
 * `$currentUser.assignments.<table>[0]` token. Engine redirects here when
 * the user has more than one assignment in the templated scope. Designer
 * controls the URL — there is no engine convention for the picker path.
 *
 * Validation:
 * - Must start with `/`
 * - Must NOT contain any `$currentUser.assignments.<table>[0]` token (the
 *   multi-record case has no single ID to substitute)
 * - Cross-validated against `defaultLanding` at the role level: only
 *   meaningful when `defaultLanding` has a template
 *
 * @example
 * ```yaml
 * pickerLanding: /portal/select/clients
 * pickerLanding: /portal/companies-picker
 * ```
 */
export const PickerLandingSchema = Schema.String.pipe(
  Schema.pattern(/^\//),
  Schema.filter((value) =>
    validateLandingUrlTokens('pickerLanding', value, { allowToken: false, requireToken: false })
  ),
  Schema.annotations({
    title: 'Picker Landing URL',
    description:
      'Multi-record fallback URL for the role. Used when defaultLanding has a $currentUser.assignments.<table>[0] token and the user has more than one assignment in that scope. Must start with /. Must not contain any assignment tokens.',
    examples: ['/portal/select/clients', '/portal/companies-picker'],
  })
)

/**
 * Custom Role Definition Schema
 *
 * Defines a custom role with optional description, hierarchy level, and
 * post-login landing rules.
 *
 * @example
 * ```typescript
 * { name: 'editor', description: 'Can edit content', level: 30 }
 * { name: 'moderator' }
 * { name: 'engineer', defaultLanding: '/admin' }
 * { name: 'customer-admin',
 *   defaultLanding: '/portal/clients/$currentUser.assignments.clients[0]',
 *   pickerLanding: '/portal/select/clients' }
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
  defaultLanding: Schema.optional(DefaultLandingSchema),
  pickerLanding: Schema.optional(PickerLandingSchema),
}).pipe(
  Schema.filter((role) => {
    if (role.pickerLanding && !role.defaultLanding) {
      return `Role '${role.name}' has pickerLanding but no defaultLanding. pickerLanding is the multi-record fallback for a templated defaultLanding.`
    }
    if (role.pickerLanding && role.defaultLanding) {
      // Use match() instead of test() — test() on a /g regex has stateful
      // lastIndex which would mutate the shared pattern (rejected by ESLint
      // functional/immutable-data). match() returns null or an array.
      const hasToken = role.defaultLanding.match(ASSIGNMENT_TOKEN_PATTERN) !== null
      if (!hasToken) {
        return `Role '${role.name}' has pickerLanding but defaultLanding has no $currentUser.assignments.<table>[0] token. pickerLanding is only meaningful when defaultLanding is templated.`
      }
    }
    return undefined
  }),
  Schema.annotations({
    title: 'Role Definition',
    description:
      'Custom role definition with name, optional description, hierarchy level, and post-login landing rules.',
    examples: [
      { name: 'editor', description: 'Can edit content', level: 30 },
      { name: 'moderator', level: 20 },
      { name: 'contributor' },
      { name: 'engineer', defaultLanding: '/admin' },
      {
        name: 'customer-admin',
        defaultLanding: '/portal/clients/$currentUser.assignments.clients[0]',
        pickerLanding: '/portal/select/clients',
      },
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

/** @public */
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

/** @public */
export type DefaultRole = Schema.Schema.Type<typeof DefaultRoleSchema>
