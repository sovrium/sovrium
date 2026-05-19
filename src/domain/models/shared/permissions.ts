/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const PermissionValueSchema = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('authenticated'),
  Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Role List',
      description: 'Array of role names that have access (e.g., admin, editor). At least one role.',
      examples: [['admin'], ['admin', 'editor'], ['admin', 'member', 'viewer']],
    })
  )
).pipe(
  Schema.annotations({
    title: 'Permission Value',
    description:
      "Permission value for a single operation. 'all' (everyone), 'authenticated' (logged-in users), or role array ['admin', 'editor'].",
    examples: ['all', 'authenticated', ['admin'], ['admin', 'editor']],
  })
)

export type PermissionValue = Schema.Schema.Type<typeof PermissionValueSchema>


export function hasPermission(permission: unknown, userRole: string): boolean {
  if (!permission) return false
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}

export function isAdminRole(userRole: string): boolean {
  return userRole === 'admin'
}

export function checkPermissionWithAdminOverride(
  isAdmin: boolean,
  permission: unknown,
  userRole: string
): boolean {
  return isAdmin || hasPermission(permission, userRole)
}

export function extractRolesFromPermission(permission: unknown): readonly string[] {
  if (!permission) return []
  if (typeof permission === 'string') return []
  if (Array.isArray(permission)) return permission as readonly string[]
  return []
}
