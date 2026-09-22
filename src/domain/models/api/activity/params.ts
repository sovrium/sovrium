/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ============================================================================
// OpenAPI Path Parameter Schemas
// ============================================================================

/**
 * Activity ID path parameter
 */
export const activityIdParamSchema = Schema.Struct({
  activityId: Schema.String.annotate({ description: 'Activity log identifier' }),
})

// ============================================================================
// OpenAPI Query Parameter Schemas
// ============================================================================

/**
 * Activity log query parameters
 */
export const activityQuerySchema = Schema.Struct({
  page: optionalField(Schema.String.annotate({ description: 'Page number' })),
  pageSize: optionalField(Schema.String.annotate({ description: 'Items per page' })),
  tableId: optionalField(Schema.String.annotate({ description: 'Filter by table ID' })),
  action: optionalField(
    Schema.Literals(['create', 'update', 'delete', 'restore']).annotate({
      description: 'Filter by action',
    })
  ),
})
