/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Pagination metadata schema
 *
 * Common pagination fields used across list endpoints.
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).describe('Current page number (1-indexed)'),
  limit: z.number().int().min(1).max(100).describe('Items per page'),
  total: z.number().int().min(0).describe('Total number of items'),
  totalPages: z.number().int().min(0).describe('Total number of pages'),
  hasNextPage: z.boolean().describe('Whether there are more pages'),
  hasPreviousPage: z.boolean().describe('Whether there are previous pages'),
})

/**
 * Pagination query parameters schema
 *
 * Used for parsing pagination query parameters.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Page number'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page'),
})

/**
 * Timestamp metadata schema
 *
 * Common timestamp fields for audit trails.
 */
export const timestampSchema = z.object({
  createdAt: z.string().datetime().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().datetime().describe('ISO 8601 last update timestamp'),
})

/**
 * Success response wrapper schema
 *
 * Standard wrapper for successful responses.
 */
export const successResponseSchema = z.object({
  success: z.literal(true).describe('Operation success indicator'),
})

/**
 * TypeScript types inferred from schemas
 */
export type Pagination = z.infer<typeof paginationSchema>
export type PaginationQuery = z.infer<typeof paginationQuerySchema>
export type Timestamps = z.infer<typeof timestampSchema>
export type SuccessResponse = z.infer<typeof successResponseSchema>
