/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FlexibleRolesSchema } from '@/domain/models/app/permissions'

/**
 * Role-Based View Permissions Schema
 *
 * Defines view access control using role arrays for read and write operations.
 * Uses FlexibleRolesSchema to support both standard and custom roles.
 *
 * @example
 * ```typescript
 * { read: ['admin', 'member'], write: ['admin'] }
 * ```
 */
export const RoleBasedViewPermissionsSchema = Schema.Struct({
  /**
   * Roles that can read (view) this view.
   */
  read: Schema.optional(FlexibleRolesSchema),

  /**
   * Roles that can write (modify settings of) this view.
   */
  write: Schema.optional(FlexibleRolesSchema),
}).pipe(
  Schema.annotations({
    title: 'Role-Based View Permissions',
    description: 'View access control using role arrays.',
    examples: [
      { read: ['admin', 'member'], write: ['admin'] },
      { read: ['admin', 'member', 'viewer'] },
    ],
  })
)

/**
 * Public View Permissions Schema
 *
 * Marks a view as publicly accessible (no authentication required).
 *
 * @example
 * ```typescript
 * { public: true }
 * ```
 */
export const PublicViewPermissionsSchema = Schema.Struct({
  /**
   * When true, the view is accessible without authentication.
   */
  public: Schema.Literal(true),
}).pipe(
  Schema.annotations({
    title: 'Public View Permissions',
    description: 'View is publicly accessible without authentication.',
    examples: [{ public: true as const }],
  })
)

/**
 * View Permissions Schema
 *
 * Permissions configuration for the view, defining who can access or modify it.
 * Supports two modes:
 * 1. Role-based: `{ read: ['admin', 'member'], write: ['admin'] }`
 * 2. Public access: `{ public: true }`
 *
 * @example Role-based permissions
 * ```typescript
 * { read: ['admin', 'user'], write: ['admin'] }
 * ```
 *
 * @example Public view
 * ```typescript
 * { public: true }
 * ```
 */
export const ViewPermissionsSchema = Schema.Union(
  RoleBasedViewPermissionsSchema,
  PublicViewPermissionsSchema
).pipe(
  Schema.annotations({
    title: 'View Permissions',
    description:
      'Permission configuration for the view. Use role-based ({ read, write }) or public ({ public: true }).',
    examples: [{ read: ['admin', 'member'], write: ['admin'] }, { public: true as const }],
  })
)

export type ViewPermissions = Schema.Schema.Type<typeof ViewPermissionsSchema>
export type RoleBasedViewPermissions = Schema.Schema.Type<typeof RoleBasedViewPermissionsSchema>
export type PublicViewPermissions = Schema.Schema.Type<typeof PublicViewPermissionsSchema>
