/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * View API schemas
 *
 * Re-exports view-related schemas from the main tables module.
 * This file exists so that the `views` route sub-resource
 * (/api/tables/:tableId/views) has a matching schema file,
 * following the API schema directory convention.
 */
export {
  viewSchema,
  listViewsResponseSchema,
  getViewResponseSchema,
  getViewRecordsResponseSchema,
  type View,
} from './tables'
