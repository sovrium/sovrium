/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TablePermissionSchema } from '@/domain/models/app/tables/permissions'

/**
 * Role-Based View Permissions Schema
 *
 * Defines view access control using the same permission format as table-level permissions.
 * Accepts 'all', 'authenticated', or role arrays for read access.
 *
 * There is no view-level `write` grant. A view is a saved projection of a
 * table; writes go to the TABLE, and `permissions.create`/`update`/`delete`
 * there are what the write path actually enforces. The key that once sat here
 * had no reader anywhere in the engine — it read as a restriction to anyone
 * auditing a config while restricting nothing, which is worse than its absence.
 *
 * @example
 * ```typescript
 * { read: ['admin', 'member'] }
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
}).pipe(
  Schema.annotate({
    title: 'Role-Based View Permissions',
    description: "View access control. Read accepts 'all', 'authenticated', or role arrays.",
    examples: [
      { read: ['admin', 'member'] },
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
  Schema.annotate({
    title: 'Public View Permissions',
    description: 'View is publicly accessible without authentication.',
    examples: [{ public: true as const }],
  })
)

/**
 * View Permissions Schema
 *
 * Permissions configuration for the view, defining who can access it.
 * Supports two modes:
 * 1. Role-based: `{ read: ['admin', 'member'] }`
 * 2. Public access: `{ public: true }`
 *
 * @example Role-based permissions
 * ```typescript
 * { read: ['admin', 'user'] }
 * ```
 *
 * @example Public view
 * ```typescript
 * { public: true }
 * ```
 *
 * MEMBER ORDER IS LOAD-BEARING — do not sort these alphabetically or "tidy" them
 * back to the documentation's 1./2. order.
 *
 * Effect 3 routed `{ public: true }` to the member declaring
 * `public: Schema.Literal(true)` via a literal-discriminant search tree, so order
 * did not matter. Effect 4 takes the FIRST member that decodes. Because
 * `RoleBasedViewPermissionsSchema`'s only field is optional, it decodes ANY
 * object and strips what it does not know — so with it first, `{ public: true }`
 * silently decoded to `{}` and a view configured as public quietly stopped being
 * public. No type error, no thrown issue, and `{}` is a valid value of the union
 * type. `probe-union-shadowing.ts` walks the whole `AppSchema` for this shape;
 * this is the only occurrence in 1,627 unions.
 */
export const ViewPermissionsSchema = Schema.Union([
  PublicViewPermissionsSchema,
  RoleBasedViewPermissionsSchema,
]).pipe(
  Schema.annotate({
    title: 'View Permissions',
    description:
      'Permission configuration for the view. Use role-based ({ read }) or public ({ public: true }).',
    examples: [{ read: ['admin', 'member'] }, { public: true as const }],
  })
)

/** @public */
export type ViewPermissions = Schema.Schema.Type<typeof ViewPermissionsSchema>
/** @public */
export type RoleBasedViewPermissions = Schema.Schema.Type<typeof RoleBasedViewPermissionsSchema>
/** @public */
export type PublicViewPermissions = Schema.Schema.Type<typeof PublicViewPermissionsSchema>
