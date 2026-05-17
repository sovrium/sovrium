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

// Re-export shared permission utilities for backward compatibility.
// Consumers like presentation/api/* import these from tables/permissions.
// New code should import from '@/domain/models/shared/permissions' directly.
export { hasPermission, isAdminRole, checkPermissionWithAdminOverride }

// ---------------------------------------------------------------------------
// Permission (base union type — re-exported from shared)
// ---------------------------------------------------------------------------

/**
 * Table Permission Schema
 *
 * Re-export of PermissionValueSchema for backward compatibility.
 * All new code should import PermissionValueSchema from shared/permissions.
 *
 * Accepts one of 3 formats:
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array)
 */
export const TablePermissionSchema = PermissionValueSchema

export type TablePermission = Schema.Schema.Type<typeof TablePermissionSchema>

// ---------------------------------------------------------------------------
// Field Permission
// ---------------------------------------------------------------------------

/**
 * Field Permission Schema
 *
 * Defines granular permissions for a specific field within a table.
 * Allows restricting read/write access to individual columns based on roles.
 * Uses the same 3-format permission system as table-level operations.
 *
 * @example Restrict salary field to admins only
 * ```yaml
 * - field: salary
 *   read: ['admin', 'hr']
 *   write: ['admin']
 * ```
 *
 * @example Make department readable by all, writable by admins
 * ```yaml
 * - field: department
 *   read: all
 *   write: ['admin']
 * ```
 */
export const FieldPermissionSchema = Schema.Struct({
  /**
   * The name of the field this permission applies to.
   */
  field: Schema.String,

  /**
   * Who can read (SELECT) this field.
   * If not specified, inherits from table-level read permission.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * Who can write (INSERT/UPDATE) this field.
   * If not specified, inherits from table-level create/update permission.
   */
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

/** @public */
export type FieldPermission = Schema.Schema.Type<typeof FieldPermissionSchema>

/**
 * Table Field Permissions Array Schema
 *
 * Array of field-level permission configurations for table permissions.
 */
export const TableFieldPermissionsSchema = Schema.Array(FieldPermissionSchema).pipe(
  Schema.annotations({
    title: 'Table Field Permissions',
    description: 'Array of field-level permission configurations for table permissions.',
  })
)

export type TableFieldPermissions = Schema.Schema.Type<typeof TableFieldPermissionsSchema>

// ---------------------------------------------------------------------------
// Resource:Action Permissions
// ---------------------------------------------------------------------------

/**
 * Resource Name Schema
 *
 * Validates resource names in the resource:action permission pattern.
 * Must start with a letter and contain only lowercase letters, numbers, underscores, or hyphens.
 *
 * @example
 * Valid: "users", "posts", "api_keys", "user-profiles"
 * Invalid: "123users", "_posts", "User Posts"
 */
export const ResourceNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Resource Name',
    description: 'Resource identifier (e.g., "users", "posts", "analytics")',
    examples: ['users', 'posts', 'api_keys', 'user-profiles'],
  })
)

/** @public */
export type ResourceName = Schema.Schema.Type<typeof ResourceNameSchema>

/**
 * Action Name Schema
 *
 * Validates action names in the resource:action permission pattern.
 * Must start with a letter and contain only lowercase letters, numbers, underscores, or hyphens.
 *
 * @example
 * Valid: "read", "write", "create", "delete", "list_all"
 * Invalid: "123read", "_write"
 */
export const ActionNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Action Name',
    description: 'Action identifier (e.g., "read", "write", "create", "delete")',
    examples: ['read', 'write', 'create', 'update', 'delete', 'list'],
  })
)

/** @public */
export type ActionName = Schema.Schema.Type<typeof ActionNameSchema>

/**
 * Action with Wildcard Schema
 *
 * Either a specific action name or "*" for all actions on a resource.
 */
export const ActionWithWildcardSchema = Schema.Union(Schema.Literal('*'), ActionNameSchema).pipe(
  Schema.annotations({
    title: 'Action',
    description: 'Action name or "*" for all actions',
    examples: ['read', 'write', '*'],
  })
)

/** @public */
export type ActionWithWildcard = Schema.Schema.Type<typeof ActionWithWildcardSchema>

/**
 * Resource:Action Permissions Schema (Shared)
 *
 * Defines granular permissions using the resource:action pattern.
 * Each resource maps to an array of allowed actions.
 *
 * This schema is shared between:
 * - Admin plugin (customPermissions)
 * - API Keys plugin (resourcePermissions)
 * - Any future permission-based features
 *
 * @example
 * ```typescript
 * {
 *   users: ['read', 'list'],
 *   posts: ['create', 'read', 'update', 'delete'],
 *   analytics: ['*']  // Wildcard for all actions
 * }
 * ```
 */
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

/** @public */
export type ResourceActionPermissions = Schema.Schema.Type<typeof ResourceActionPermissionsSchema>

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Standard Role Schema
 *
 * The three built-in roles used across the authentication system.
 * These roles have well-defined hierarchies and permissions.
 *
 * Role Hierarchy (highest to lowest):
 * - `admin`: Can manage members and settings
 * - `member`: Standard access to organization resources
 * - `viewer`: Read-only access
 *
 * @example
 * ```typescript
 * defaultRole: 'member'
 * creatorRole: 'admin'
 * ```
 */
export const StandardRoleSchema = Schema.Literal('admin', 'member', 'viewer').pipe(
  Schema.annotations({
    title: 'Standard Role',
    description: 'Built-in role with predefined permissions. Hierarchy: admin > member > viewer',
    examples: ['admin', 'member', 'viewer'],
  })
)

/** @public */
export type StandardRole = Schema.Schema.Type<typeof StandardRoleSchema>

/**
 * Admin-Level Role Schema
 *
 * Subset of roles with administrative capabilities.
 * Used for features like role creation/assignment restrictions.
 */
export const AdminLevelRoleSchema = Schema.Literal('admin').pipe(
  Schema.annotations({
    title: 'Admin-Level Role',
    description: 'Roles with administrative capabilities (admin)',
    examples: ['admin'],
  })
)

/** @public */
export type AdminLevelRole = Schema.Schema.Type<typeof AdminLevelRoleSchema>

/**
 * User-Level Role Schema
 *
 * Subset of standard roles for default user role assignment.
 * Used in admin plugin for defaultRole configuration.
 */
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

/** @public */
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
    examples: [['admin'], ['admin', 'member'], ['admin', 'editor', 'custom-role']],
  })
)

/** @public */
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
    description: 'Array of standard roles only (admin, member, viewer)',
    examples: [['admin'], ['admin', 'member'], ['admin', 'member', 'viewer']],
  })
)

/** @public */
export type StandardRolesArray = Schema.Schema.Type<typeof StandardRolesArraySchema>

// ---------------------------------------------------------------------------
// Table Permissions (main schema — uses TablePermissionSchema & TableFieldPermissionsSchema)
// ---------------------------------------------------------------------------

/**
 * Table Permissions Schema
 *
 * Permissions for table operations using a simplified 3-format system.
 * Each operation accepts one of:
 * - `'all'` — Everyone (including unauthenticated users)
 * - `'authenticated'` — Any logged-in user
 * - `['admin', 'editor']` — Specific role names (array)
 *
 * Operations:
 * - `read` — Who can view records
 * - `comment` — Who can add comments to records
 * - `create` — Who can create new records
 * - `update` — Who can modify existing records
 * - `delete` — Who can remove records
 *
 * Omitted operations default to deny (no access).
 *
 * @example Role-based permissions
 * ```yaml
 * permissions:
 *   read: all
 *   comment: authenticated
 *   create: ['admin', 'editor']
 *   update: ['admin', 'editor']
 *   delete: ['admin']
 * ```
 *
 * @example Minimal read-only public table
 * ```yaml
 * permissions:
 *   read: all
 * ```
 */
export const TablePermissionsSchema = Schema.Struct({
  /**
   * READ permission — who can view records from this table.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * COMMENT permission — who can add comments to records.
   */
  comment: Schema.optional(TablePermissionSchema),

  /**
   * CREATE permission — who can create new records in this table.
   */
  create: Schema.optional(TablePermissionSchema),

  /**
   * UPDATE permission — who can modify existing records in this table.
   */
  update: Schema.optional(TablePermissionSchema),

  /**
   * DELETE permission — who can soft-delete records from this table.
   */
  delete: Schema.optional(TablePermissionSchema),

  /**
   * PERMANENT DELETE permission — who can permanently remove soft-deleted records.
   */
  permanentDelete: Schema.optional(TablePermissionSchema),

  /**
   * RESTORE permission — who can restore soft-deleted records.
   */
  restore: Schema.optional(TablePermissionSchema),

  /**
   * Field-level permissions for granular column access control.
   *
   * Allows restricting read/write access to specific fields based on roles.
   * Uses the same 3-format permission system as table-level operations.
   *
   * @example Restrict salary field to admins
   * ```yaml
   * fields:
   *   - field: salary
   *     read: ['admin', 'hr']
   *     write: ['admin']
   * ```
   */
  fields: Schema.optional(TableFieldPermissionsSchema),

  /**
   * INHERIT — inherit permissions from a parent table by name.
   *
   * When set, this table inherits all permissions from the specified parent table.
   * Any explicitly defined permissions on this table take precedence over inherited ones.
   * Circular inheritance chains are detected and rejected at configuration time.
   *
   * @example Inherit permissions from parent table
   * ```yaml
   * permissions:
   *   inherit: articles
   * ```
   *
   * @future Not yet implemented — target design for permission inheritance feature.
   */
  inherit: Schema.optional(
    Schema.String.pipe(
      Schema.nonEmptyString({ message: () => 'inherit table name must not be empty' }),
      Schema.annotations({
        description: 'Name of the parent table to inherit permissions from',
      })
    )
  ),

  /**
   * OVERRIDE — override specific inherited permissions.
   *
   * Only meaningful when `inherit` is set. Allows overriding specific
   * permission operations from the parent table while inheriting the rest.
   *
   * @example Override read permission from inherited parent
   * ```yaml
   * permissions:
   *   inherit: articles
   *   override:
   *     read: ['admin']
   * ```
   *
   * @future Not yet implemented — target design for permission inheritance feature.
   */
  override: Schema.optional(
    Schema.Struct({
      read: Schema.optional(TablePermissionSchema),
      comment: Schema.optional(TablePermissionSchema),
      create: Schema.optional(TablePermissionSchema),
      update: Schema.optional(TablePermissionSchema),
      delete: Schema.optional(TablePermissionSchema),
      permanentDelete: Schema.optional(TablePermissionSchema),
      restore: Schema.optional(TablePermissionSchema),
      /** Admin-specific permission overrides */
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
      // Public read, admin-only write
      {
        read: 'all' as const,
        comment: 'authenticated' as const,
        create: ['admin'] as readonly string[],
        update: ['admin'] as readonly string[],
        delete: ['admin'] as readonly string[],
      },
      // Role-based with field restrictions
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

// Re-export permission evaluator functions for backward compatibility
export {
  evaluateTablePermissions,
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
  hasUpdatePermission,
  hasReadPermission,
  resolveInheritedPermissions,
} from '@/domain/validators/permission-evaluators'

// ---------------------------------------------------------------------------
// User Access Junction (Z-2 — multi-tenant scoping)
// ---------------------------------------------------------------------------

/**
 * User Access Row Schema
 *
 * One row in the multi-tenant `user_access` junction table. A row grants a
 * user access to **one or more records** in **one app table** with a
 * **specific role**.
 *
 * The schema is **fully generic and table-agnostic**:
 *
 * - `table_slug` is any string from `auth.scopeTables` (e.g. `'clients'`,
 *   `'projects'`, `'orgs'`). The engine validates membership at insert
 *   time — schema-level validation only enforces the slug pattern.
 * - `record_ids` is a non-empty array of UUIDs in that table. A row may
 *   reference multiple records (e.g., a customer-admin with several
 *   delegated projects).
 * - `role` is any string from `auth.roles[].name`. Roles are app-defined
 *   (no engine-level role enum). Validated at insert time against the
 *   active app config.
 *
 * One user may have multiple rows: different `table_slug` values
 * (cross-table scopes), or several rows in the same table with different
 * `record_ids` / `role` combinations (e.g., admin of project A + member
 * of project B).
 *
 * `created_at` / `created_by` track grant provenance for audit trails.
 *
 * @example A customer-admin row
 * ```typescript
 * {
 *   id: 'a3f1...',
 *   user_id: 'u-12345...',
 *   table_slug: 'clients',
 *   record_ids: ['c-acme'],
 *   role: 'customer-admin',
 *   created_at: new Date('2026-05-01T00:00:00Z'),
 *   created_by: 'u-engineer',
 * }
 * ```
 *
 * @example A multi-record member row
 * ```typescript
 * {
 *   id: '...',
 *   user_id: 'u-fractional-cfo',
 *   table_slug: 'projects',
 *   record_ids: ['p-alpha', 'p-beta', 'p-gamma'],
 *   role: 'customer-member',
 *   created_at: new Date('2026-05-01'),
 *   created_by: 'u-admin',
 * }
 * ```
 */
export const UserAccessRowSchema = Schema.Struct({
  /** Primary key (UUID) */
  id: Schema.UUID,

  /** Foreign key to Better Auth `user.id` */
  user_id: Schema.UUID,

  /**
   * App table the access grant scopes to.
   *
   * Must match a `name` in `app.tables[]` AND must be listed in
   * `auth.scopeTables`. Validated at insert time, not at schema-decode time
   * (the schema does not have access to the active app config).
   */
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

  /**
   * One or more records this row grants access to.
   *
   * Non-empty array. UUIDs reference rows in the table named by
   * `table_slug`. Engine-level row-level enforcement (Z-3) consults this
   * array via the `$currentUser.assignments.<table_slug>` path.
   */
  record_ids: Schema.Array(Schema.UUID).pipe(
    Schema.minItems(1, {
      message: () => 'record_ids must contain at least one UUID',
    }),
    Schema.annotations({
      description: 'Records the user can access. Engine flattens across multiple rows.',
    })
  ),

  /**
   * Role within this scope.
   *
   * Free-form string validated at insert time against `auth.roles[].name`.
   * **Independent** of Better Auth global role: a Better Auth `member` may
   * hold a row with `role: 'customer-admin'` for a specific scope.
   */
  role: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'App-defined role within this scope (validated against auth.roles)',
    })
  ),

  /** Timestamp of grant (audit) */
  created_at: Schema.Date,

  /** UUID of the user who granted this access (audit) */
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

/** @public */
export type UserAccessRow = Schema.Schema.Type<typeof UserAccessRowSchema>

// ---------------------------------------------------------------------------
// Row-Level Permission Predicates (Z-3 — defense-in-depth)
// ---------------------------------------------------------------------------
// Schemas live in their own file (`row-level-permissions.ts`) per the schema
// mirroring convention: every object-type top-level schema field on
// `TableSchema` lives in its own dedicated file. Re-exported here so existing
// consumers (presentation routes, application use-cases, validators) keep
// importing from `@/domain/models/app/tables/permissions`.
export {
  RowLevelFilterOperatorSchema,
  RowLevelPredicateSchema,
  RowLevelPermissionsSchema,
  type RowLevelFilterOperator,
  type RowLevelPredicate,
  type RowLevelPermissions,
} from './row-level-permissions'
