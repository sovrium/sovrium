/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthenticatedPermissionSchema } from './authenticated'
import { CustomPermissionSchema } from './custom'
import { OwnerPermissionSchema } from './owner'
import { PublicPermissionSchema } from './public'
import { RolesPermissionSchema } from './roles'

/**
 * Table Permission Schema
 *
 * Union of all permission types for a single CRUD operation.
 *
 * @example
 * ```typescript
 * // Public access
 * { type: 'public' }
 *
 * // Authenticated users only
 * { type: 'authenticated' }
 *
 * // Role-based access
 * { type: 'roles', roles: ['admin', 'member'] }
 *
 * // Owner-based access (record owner only)
 * { type: 'owner', field: 'owner_id' }
 *
 * // Custom RLS condition
 * { type: 'custom', condition: '{userId} = owner_id' }
 * ```
 */
export const TablePermissionSchema = Schema.Union(
  PublicPermissionSchema,
  AuthenticatedPermissionSchema,
  RolesPermissionSchema,
  OwnerPermissionSchema,
  CustomPermissionSchema
).pipe(
  Schema.annotations({
    title: 'Table Permission',
    description:
      'Permission configuration for a single CRUD operation (public, authenticated, role-based, or owner-based).',
    examples: [
      { type: 'public' as const },
      { type: 'authenticated' as const },
      { type: 'roles' as const, roles: ['admin', 'member'] },
      { type: 'owner' as const, field: 'owner_id' },
      { type: 'custom' as const, condition: '{userId} = owner_id' },
    ],
  })
)

export type TablePermission = Schema.Schema.Type<typeof TablePermissionSchema>
