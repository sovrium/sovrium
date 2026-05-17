/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Permission Value (shared across all features)
// ---------------------------------------------------------------------------

/**
 * Permission Value Schema
 *
 * Universal permission value used across all features (tables, buckets,
 * automations, agents, pages). Accepts one of 3 formats:
 *
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array, at least one)
 *
 * @example
 * ```yaml
 * permissions:
 *   read: all
 *   upload: authenticated
 *   delete: ['admin']
 *   create: ['admin', 'editor']
 * ```
 */
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

/** @public */
export type PermissionValue = Schema.Schema.Type<typeof PermissionValueSchema>

// ---------------------------------------------------------------------------
// Permission Evaluator (shared utility functions)
// ---------------------------------------------------------------------------

/**
 * Check if user has permission based on permission configuration.
 *
 * Permission format (3-format system):
 * - `'all'` — Everyone (including unauthenticated)
 * - `'authenticated'` — Any logged-in user
 * - `string[]` — Specific role names
 */
export function hasPermission(permission: unknown, userRole: string): boolean {
  if (!permission) return false
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}

/**
 * Check if user role has admin privileges
 */
export function isAdminRole(userRole: string): boolean {
  return userRole === 'admin'
}

/**
 * Check permission with admin override
 */
export function checkPermissionWithAdminOverride(
  isAdmin: boolean,
  permission: unknown,
  userRole: string
): boolean {
  return isAdmin || hasPermission(permission, userRole)
}

/**
 * Extract role names from a permission value.
 * Returns empty array for 'all', 'authenticated', or missing values.
 * Returns the role names array for string[] permissions.
 */
export function extractRolesFromPermission(permission: unknown): readonly string[] {
  if (!permission) return []
  if (typeof permission === 'string') return [] // 'all' or 'authenticated'
  if (Array.isArray(permission)) return permission as readonly string[]
  return []
}
