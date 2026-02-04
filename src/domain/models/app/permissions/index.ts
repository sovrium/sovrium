/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Unified Permission Type Registry
 *
 * This module provides centralized, reusable permission-related schemas
 * used across the authentication and authorization system.
 *
 * ## Permission Domains
 *
 * ### 1. Resource:Action Permissions
 * Used for API access control (admin plugin, API keys).
 * Pattern: `{ resource: [actions] }` where actions can include '*' for wildcard.
 *
 * ### 2. Role-Based Permissions
 * Hierarchical roles (owner > admin > member > viewer) with predefined capabilities.
 *
 * ### 3. Table/Record Permissions
 * Application-layer permission checking for data access control.
 * See `@/domain/models/app/table/permissions/` for table-specific schemas.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   ResourceActionPermissionsSchema,
 *   StandardRoleSchema,
 * } from '@/domain/models/app/permissions'
 * ```
 */

// Resource:Action pattern for API permissions
export {
  ResourceActionPermissionsSchema,
  ResourceNameSchema,
  ActionNameSchema,
  ActionWithWildcardSchema,
  type ResourceActionPermissions,
  type ResourceName,
  type ActionName,
  type ActionWithWildcard,
} from './resource-action'

// Role definitions
export {
  StandardRoleSchema,
  AdminLevelRoleSchema,
  UserLevelRoleSchema,
  FlexibleRolesSchema,
  StandardRolesArraySchema,
  type StandardRole,
  type AdminLevelRole,
  type UserLevelRole,
  type FlexibleRoles,
  type StandardRolesArray,
} from './roles'
