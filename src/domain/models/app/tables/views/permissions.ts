/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FlexibleRolesSchema, TablePermissionSchema } from '@/domain/models/app/tables/permissions'

export const RoleBasedViewPermissionsSchema = Schema.Struct({
  read: Schema.optional(TablePermissionSchema),

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

export const PublicViewPermissionsSchema = Schema.Struct({
  public: Schema.Literal(true),
}).pipe(
  Schema.annotations({
    title: 'Public View Permissions',
    description: 'View is publicly accessible without authentication.',
    examples: [{ public: true as const }],
  })
)

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
