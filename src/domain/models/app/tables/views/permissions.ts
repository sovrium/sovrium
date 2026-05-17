/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FlexibleRolesSchema, TablePermissionSchema } from '@/domain/models/app/tables/permissions'

/**
 * Role-Based View Permissions Schema
 *
 * Defines view access control using the same permission format as table-level permissions.
 * Accepts 'all', 'authenticated', or role arrays for read and write operations.
 *
 * @example
 * ```typescript
 * { read: ['admin', 'member'], write: ['admin'] }
 * { read: 'authenticated' }
 * { read: 'all' }
 * ```
 */
export const RoleBasedViewPermissionsSchema = Schema.Struct({
  /**
   * Roles that can read (view) this view.
   * Accepts 'all', 'authenticated', or role arrays.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * Roles that can write (modify settings of) this view.
   * Accepts 'all', 'authenticated', or role arrays.
   */
  write: Schema.optional(FlexibleRolesSchema),
}).pipe(
  Schema.annotations({
    title: 'Role-Based View Permissions',
    description: "View access control. Read accepts 'all', 'authenticated', or role arrays.",
    examples: [
      { read: ['admin', 'member'], write: ['admin'] },
      { read: ['admin', 'member', 'viewer'] },
      { read: 'authenticated' as const },
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

/** @public */
export type ViewPermissions = Schema.Schema.Type<typeof ViewPermissionsSchema>
/** @public */
export type RoleBasedViewPermissions = Schema.Schema.Type<typeof RoleBasedViewPermissionsSchema>
/** @public */
export type PublicViewPermissions = Schema.Schema.Type<typeof PublicViewPermissionsSchema>
