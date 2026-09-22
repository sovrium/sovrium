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
 * Table ID path parameter
 */
export const tableIdParamSchema = Schema.Struct({
  tableId: Schema.String.annotate({ description: 'Table identifier' }),
})

/**
 * Record ID path parameters (includes tableId)
 */
export const recordIdParamSchema = Schema.Struct({
  tableId: Schema.String.annotate({ description: 'Table identifier' }),
  recordId: Schema.String.annotate({ description: 'Record identifier' }),
})

/**
 * Comment ID path parameters (includes tableId and recordId)
 */
export const commentIdParamSchema = Schema.Struct({
  tableId: Schema.String.annotate({ description: 'Table identifier' }),
  recordId: Schema.String.annotate({ description: 'Record identifier' }),
  commentId: Schema.String.annotate({ description: 'Comment identifier' }),
})

/**
 * View ID path parameters (includes tableId)
 */
export const viewIdParamSchema = Schema.Struct({
  tableId: Schema.String.annotate({ description: 'Table identifier' }),
  viewId: Schema.String.annotate({ description: 'View identifier' }),
})

// ============================================================================
// Config-Driven (Expanded) Path Parameter Schemas
// ============================================================================
// Used by config-driven OpenAPI routes where the table is baked into the
// concrete path (e.g. /api/tables/contacts/records/{recordId}), so `tableId`
// is NOT a variable path parameter and must be omitted from the params schema.

/**
 * Record ID path parameter (tableId is concrete in the expanded path)
 *
 * Effect Schema (see the migration note at the foot of this file). Consumed by
 * the OpenAPI document via `effectParameters(..., 'path')`.
 */
export const recordOnlyParamSchema = Schema.Struct({
  recordId: Schema.String.annotate({ description: 'Record identifier' }),
})

/**
 * Comment ID path parameters (tableId is concrete in the expanded path)
 */
export const commentOnlyParamSchema = Schema.Struct({
  recordId: Schema.String.annotate({ description: 'Record identifier' }),
  commentId: Schema.String.annotate({ description: 'Comment identifier' }),
})

/**
 * View ID path parameter (tableId is concrete in the expanded path)
 */
export const viewOnlyParamSchema = Schema.Struct({
  viewId: Schema.String.annotate({ description: 'View identifier' }),
})

// ============================================================================
// OpenAPI Query Parameter Schemas
// ============================================================================

/** Optional query string with a description. Annotate BEFORE any check. */
const queryString = (description: string) => optionalField(Schema.String.annotate({ description }))

/**
 * List records query parameters
 *
 * Every member goes through `optionalField`, NOT a bare `Schema.optionalKey`.
 * `optionalKey` alone rejects a PRESENT key holding `undefined`, which is
 * exactly how these params arrive: the route builds an explicit allow-list
 * object with every key present, because Hono drops an undeclared query param
 * silently. `optionalField` restores Zod's three accepted inputs and keeps the
 * documented contract unwidened — see its own file for how the `undefined`
 * branch is kept out of the emitted document.
 */
export const listRecordsQuerySchema = Schema.Struct({
  page: queryString('Page number (1-indexed)'),
  limit: queryString('Items per page'),
  sort: queryString('Sort expression (e.g. "field:asc,field2:desc")'),
  order: optionalField(Schema.Literals(['asc', 'desc']).annotate({ description: 'Sort order' })),
  q: queryString('Search query'),
  fields: queryString('Comma-separated field names to include'),
  format: optionalField(
    Schema.Literals(['raw', 'display']).annotate({ description: 'Field value format' })
  ),
  timezone: queryString('IANA timezone for date formatting'),
  includeDeleted: queryString('Set to "true" to include soft-deleted records'),
  deleted: queryString('Set to "true" to list only soft-deleted records (trash view)'),
  filter: queryString('Filter expression'),
  aggregate: queryString('JSON aggregate parameters'),
  groupBy: queryString(
    'Field name to group records by, or a comma-separated list of fields for nested levels (outermost first). Each named field is permission-checked'
  ),
})

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * Create/update comment request body
 *
 * The length bounds are `Schema.check`, which Effect emits as an `allOf`
 * branch; `effectSchema` folds the single branch back onto the node so the
 * served document keeps the flat `{ type, minLength, maxLength }` shape Zod
 * produced.
 */
export const commentBodySchema = Schema.Struct({
  content: Schema.String.annotate({ description: 'Comment text' }).pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(10_000))
  ),
})
