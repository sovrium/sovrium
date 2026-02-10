/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export all permission functions from domain layer.
 *
 * The canonical implementation lives in the domain layer at
 * `@/domain/models/app/table/permissions/permission-evaluator`.
 * This file re-exports for backward compatibility with existing consumers.
 */
export {
  hasPermission,
  isAdminRole,
  checkPermissionWithAdminOverride,
  evaluateTablePermissions,
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
  hasUpdatePermission,
  hasReadPermission,
} from '@/domain/models/app/table/permissions'
