/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const BUILT_IN_ROLES = ['admin', 'member', 'viewer'] as const

export const BUILT_IN_ROLE_LEVELS: Readonly<Record<string, number>> = {
  admin: 80,
  member: 40,
  viewer: 10,
}

export const BuiltInRoleSchema = Schema.Literal('admin', 'member', 'viewer').pipe(
  Schema.annotations({
    title: 'Built-in Role',
    description: 'Built-in role with predefined hierarchy. Levels: admin=80, member=40, viewer=10',
    examples: ['admin', 'member', 'viewer'],
  })
)

export type BuiltInRole = Schema.Schema.Type<typeof BuiltInRoleSchema>

export const RoleNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.annotations({
    title: 'Role Name',
    description: 'Role name: lowercase, alphanumeric, hyphens. Must start with a letter.',
    examples: ['editor', 'content-manager', 'moderator'],
  })
)

export type RoleName = Schema.Schema.Type<typeof RoleNameSchema>

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

export const RolesConfigSchema = Schema.Array(RoleDefinitionSchema).pipe(
  Schema.filter((roles) => {
    const names = roles.map((r) => r.name)
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      return `Duplicate role names: ${duplicates.join(', ')}`
    }

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

export const DefaultRoleSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Default Role',
    description:
      'Role assigned to new users by default. Accepts built-in roles or custom role names. Defaults to member.',
    examples: ['member', 'viewer', 'editor'],
  })
)

export type DefaultRole = Schema.Schema.Type<typeof DefaultRoleSchema>


export interface AdminRoleResolvable {
  readonly auth?: {
    readonly roles?: readonly {
      readonly name: string
      readonly level?: number
    }[]
  }
}

const resolveRoleLevel = (role: { readonly name: string; readonly level?: number }): number => {
  if (typeof role.level === 'number') return role.level
  return BUILT_IN_ROLE_LEVELS[role.name] ?? BUILT_IN_ROLE_LEVELS['member']!
}

export const resolveAdminRole = (app: AdminRoleResolvable): string => {
  const roles = app.auth?.roles ?? []
  if (roles.length === 0) return 'admin'
  const top = roles.reduce((best, role) =>
    resolveRoleLevel(role) > resolveRoleLevel(best) ? role : best
  )
  return top.name
}

export const isAdminEquivalent = (roleName: string, app: AdminRoleResolvable): boolean => {
  if (roleName === resolveAdminRole(app)) return true
  if (roleName === 'admin') {
    const roles = app.auth?.roles ?? []
    if (roles.length === 0) return true
    const topLevel = Math.max(...roles.map(resolveRoleLevel))
    return BUILT_IN_ROLE_LEVELS['admin']! >= topLevel
  }
  return false
}
