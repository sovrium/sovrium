/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { withDefault } from './schema-defaults'

/**
 * The widest page any list endpoint will serve.
 *
 * Exported because this number has to hold in TWO places, and having it in
 * only one of them WAS a defect. {@link paginationSchema} caps `limit` on the
 * RESPONSE, so a request naming a wider page produced a response the
 * endpoint's own contract rejected — reaching the caller as `500 Internal
 * Server Error` for what is plainly a bad request. The request side now reads
 * the same constant (`validatePaginationParams` in
 * `presentation/api/routes/tables/validation/pagination-validation.ts`), so
 * the two cannot drift: moving the ceiling here moves it for both.
 */
export const MAX_PAGE_SIZE = 100

/**
 * Pagination metadata schema
 *
 * Common pagination fields used across list endpoints.
 */
export const paginationSchema = Schema.Struct({
  page: Schema.Int.annotate({ description: 'Current page number (1-indexed)' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1))
  ),
  limit: Schema.Int.annotate({ description: 'Items per page' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(MAX_PAGE_SIZE))
  ),
  offset: Schema.Int.annotate({ description: 'Offset from start of results' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  total: Schema.Int.annotate({ description: 'Total number of items' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  totalPages: Schema.Int.annotate({ description: 'Total number of pages' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  hasNextPage: Schema.Boolean.annotate({ description: 'Whether there are more pages' }),
  hasPreviousPage: Schema.Boolean.annotate({ description: 'Whether there are previous pages' }),
}).annotate({ identifier: 'Pagination' })

/**
 * Pagination query parameters schema
 *
 * Used for parsing pagination query parameters.
 */
export const paginationQuerySchema = Schema.Struct({
  page: coercedNumber
    .annotate({ description: 'Page number' })
    .pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)), withDefault(1)),
  limit: coercedNumber
    .annotate({ description: 'Items per page' })
    .pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(MAX_PAGE_SIZE)
      ),
      withDefault(20)
    ),
})

/**
 * Timestamp metadata schema
 *
 * Common timestamp fields for audit trails.
 */
export const timestampSchema = Schema.Struct({
  createdAt: looseIsoDateTime({ description: 'ISO 8601 creation timestamp' }),
  updatedAt: looseIsoDateTime({ description: 'ISO 8601 last update timestamp' }),
}).annotate({ identifier: 'Timestamps' })

/**
 * Success response wrapper schema
 *
 * Standard wrapper for successful responses.
 */
export const successResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Operation success indicator' }),
}).annotate({ identifier: 'SuccessResponse' })

/**
 * TypeScript types inferred from schemas
 */
export type Pagination = typeof paginationSchema.Type
export type PaginationQuery = typeof paginationQuerySchema.Type
export type Timestamps = typeof timestampSchema.Type
export type SuccessResponse = typeof successResponseSchema.Type
