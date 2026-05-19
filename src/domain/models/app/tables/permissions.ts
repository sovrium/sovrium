/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  PermissionValueSchema,
  hasPermission,
  isAdminRole,
  checkPermissionWithAdminOverride,
} from '@/domain/models/shared/permissions'

export { hasPermission, isAdminRole, checkPermissionWithAdminOverride }


export const TablePermissionSchema = PermissionValueSchema

export type TablePermission = Schema.Schema.Type<typeof TablePermissionSchema>


export const FieldPermissionSchema = Schema.Struct({
  field: Schema.String,

  read: Schema.optional(TablePermissionSchema),

  write: Schema.optional(TablePermissionSchema),
}).pipe(
  Schema.annotations({
    title: 'Field Permission',
    description:
      "Granular permission for a specific field. Uses same format as table-level: 'all', 'authenticated', or role array.",
    examples: [
      {
        field: 'salary',
        read: ['admin', 'hr'] as readonly string[],
        write: ['admin'] as readonly string[],
      },
      {
        field: 'department',
        read: 'all' as const,
        write: ['admin'] as readonly string[],
      },
    ],
  })
)

export type FieldPermission = Schema.Schema.Type<typeof FieldPermissionSchema>

export const TableFieldPermissionsSchema = Schema.Array(FieldPermissionSchema).pipe(
  Schema.annotations({
    title: 'Table Field Permissions',
    description: 'Array of field-level permission configurations for table permissions.',
  })
)

export type TableFieldPermissions = Schema.Schema.Type<typeof TableFieldPermissionsSchema>


export const ResourceNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Resource Name',
    description: 'Resource identifier (e.g., "users", "posts", "analytics")',
    examples: ['users', 'posts', 'api_keys', 'user-profiles'],
  })
)

export type ResourceName = Schema.Schema.Type<typeof ResourceNameSchema>

export const ActionNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Action Name',
    description: 'Action identifier (e.g., "read", "write", "create", "delete")',
    examples: ['read', 'write', 'create', 'update', 'delete', 'list'],
  })
)

export type ActionName = Schema.Schema.Type<typeof ActionNameSchema>

export const ActionWithWildcardSchema = Schema.Union(Schema.Literal('*'), ActionNameSchema).pipe(
  Schema.annotations({
    title: 'Action',
    description: 'Action name or "*" for all actions',
    examples: ['read', 'write', '*'],
  })
)

export type ActionWithWildcard = Schema.Schema.Type<typeof ActionWithWildcardSchema>

export const ResourceActionPermissionsSchema = Schema.Record({
  key: ResourceNameSchema.pipe(
    Schema.annotations({ description: 'Resource name (e.g., "users", "posts")' })
  ),
  value: Schema.Array(ActionWithWildcardSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Allowed Actions',
      description: 'Allowed actions for this resource',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Resource:Action Permissions',
    description:
      'Granular permission definitions using resource:action pattern. Shared across admin, API keys, and other permission contexts.',
    examples: [
      {
        users: ['read', 'list'],
        posts: ['create', 'read', 'update', 'delete'],
        analytics: ['*'],
      },
      {
        comments: ['create', 'read', 'delete'],
        media: ['*'],
      },
    ],
  })
)

export type ResourceActionPermissions = Schema.Schema.Type<typeof ResourceActionPermissionsSchema>


export const StandardRoleSchema = Schema.Literal('admin', 'member', 'viewer').pipe(
  Schema.annotations({
    title: 'Standard Role',
    description: 'Built-in role with predefined permissions. Hierarchy: admin > member > viewer',
    examples: ['admin', 'member', 'viewer'],
  })
)

export type StandardRole = Schema.Schema.Type<typeof StandardRoleSchema>

export const AdminLevelRoleSchema = Schema.Literal('admin').pipe(
  Schema.annotations({
    title: 'Admin-Level Role',
    description: 'Roles with administrative capabilities (admin)',
    examples: ['admin'],
  })
)

export type AdminLevelRole = Schema.Schema.Type<typeof AdminLevelRoleSchema>

export const UserLevelRoleSchema = Schema.String.pipe(
  Schema.filter(
    (value): value is 'admin' | 'member' | 'viewer' => {
      return value === 'admin' || value === 'member' || value === 'viewer'
    },
    {
      message: () => 'Invalid role. Must be one of: admin, member, viewer',
    }
  ),
  Schema.annotations({
    title: 'User-Level Role',
    description: 'Roles available for default user assignment in admin context',
    examples: ['admin', 'member', 'viewer'],
  })
)

export type UserLevelRole = Schema.Schema.Type<typeof UserLevelRoleSchema>

export const FlexibleRolesSchema = Schema.Array(Schema.String).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Flexible Roles',
    description:
      'Array of role names (supports both standard and custom roles). At least one role required.',
    examples: [['admin'], ['admin', 'member'], ['admin', 'editor', 'custom-role']],
  })
)

export type FlexibleRoles = Schema.Schema.Type<typeof FlexibleRolesSchema>

export const StandardRolesArraySchema = Schema.Array(StandardRoleSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Standard Roles Array',
    description: 'Array of standard roles only (admin, member, viewer)',
    examples: [['admin'], ['admin', 'member'], ['admin', 'member', 'viewer']],
  })
)

export type StandardRolesArray = Schema.Schema.Type<typeof StandardRolesArraySchema>


export const TablePermissionsSchema = Schema.Struct({
  read: Schema.optional(TablePermissionSchema),

  comment: Schema.optional(TablePermissionSchema),

  create: Schema.optional(TablePermissionSchema),

  update: Schema.optional(TablePermissionSchema),

  delete: Schema.optional(TablePermissionSchema),

  permanentDelete: Schema.optional(TablePermissionSchema),

  restore: Schema.optional(TablePermissionSchema),

  fields: Schema.optional(TableFieldPermissionsSchema),

  inherit: Schema.optional(
    Schema.String.pipe(
      Schema.nonEmptyString({ message: () => 'inherit table name must not be empty' }),
      Schema.annotations({
        description: 'Name of the parent table to inherit permissions from',
      })
    )
  ),

  override: Schema.optional(
    Schema.Struct({
      read: Schema.optional(TablePermissionSchema),
      comment: Schema.optional(TablePermissionSchema),
      create: Schema.optional(TablePermissionSchema),
      update: Schema.optional(TablePermissionSchema),
      delete: Schema.optional(TablePermissionSchema),
      permanentDelete: Schema.optional(TablePermissionSchema),
      restore: Schema.optional(TablePermissionSchema),
      admin: Schema.optional(
        Schema.Struct({
          read: Schema.optional(TablePermissionSchema),
          create: Schema.optional(TablePermissionSchema),
          update: Schema.optional(TablePermissionSchema),
          delete: Schema.optional(TablePermissionSchema),
        })
      ),
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Table Permissions',
    description:
      "Permissions for table operations. Each operation accepts 'all', 'authenticated', or a role array. Omitted operations default to deny.",
    examples: [
      {
        read: 'all' as const,
        comment: 'authenticated' as const,
        create: ['admin'] as readonly string[],
        update: ['admin'] as readonly string[],
        delete: ['admin'] as readonly string[],
      },
      {
        read: 'all' as const,
        create: ['admin', 'editor'] as readonly string[],
        update: ['admin', 'editor'] as readonly string[],
        delete: ['admin'] as readonly string[],
      },
    ],
  })
)

export type TablePermissions = Schema.Schema.Type<typeof TablePermissionsSchema>

export {
  evaluateTablePermissions,
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
  hasUpdatePermission,
  hasReadPermission,
  hasReadPermissionForRoles,
  hasCreatePermissionForRoles,
  hasUpdatePermissionForRoles,
  hasDeletePermissionForRoles,
  resolveInheritedPermissions,
} from '@/domain/validators/permission-evaluators'


export const UserAccessRowSchema = Schema.Struct({
  id: Schema.UUID,

  user_id: Schema.UUID,

  table_slug: Schema.String.pipe(
    Schema.minLength(1),
    Schema.pattern(/^[a-z][a-z0-9_-]*$/i, {
      message: () =>
        "table_slug must start with a letter and contain only letters, digits, '_', or '-'",
    }),
    Schema.annotations({
      description: 'Table slug (e.g. "clients", "projects"); validated against auth.scopeTables',
    })
  ),

  record_ids: Schema.Array(Schema.UUID).pipe(
    Schema.minItems(1, {
      message: () => 'record_ids must contain at least one UUID',
    }),
    Schema.annotations({
      description: 'Records the user can access. Engine flattens across multiple rows.',
    })
  ),

  role: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'App-defined role within this scope (validated against auth.roles)',
    })
  ),

  created_at: Schema.Date,

  created_by: Schema.UUID,
}).pipe(
  Schema.annotations({
    identifier: 'UserAccessRow',
    title: 'User Access Row',
    description:
      'Multi-tenant access grant for a user. Generic shape: any (user, table, records, role) tuple. Validated against auth.scopeTables and auth.roles at insert time.',
    examples: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000002',
        table_slug: 'clients',
        record_ids: ['00000000-0000-0000-0000-000000000003'],
        role: 'customer-admin',
        created_at: new Date('2026-05-01T00:00:00Z'),
        created_by: '00000000-0000-0000-0000-000000000004',
      },
    ],
  })
)

export type UserAccessRow = Schema.Schema.Type<typeof UserAccessRowSchema>

export {
  RowLevelFilterOperatorSchema,
  RowLevelPredicateSchema,
  RowLevelPermissionsSchema,
  type RowLevelFilterOperator,
  type RowLevelPredicate,
  type RowLevelPermissions,
} from './row-level-permissions'
