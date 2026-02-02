/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { fieldValueSchema } from './tables-schemas'

// ============================================================================
// Record Request Schemas
// ============================================================================

/**
 * Create record request schema
 *
 * Validates the request body for creating a single record.
 * Requires nested format: { fields: {...} }
 */
export const createRecordRequestSchema = z.object({
  fields: z.record(z.string(), fieldValueSchema).optional().default({}),
})

/**
 * Update record request schema
 *
 * Validates the request body for updating a record.
 * Requires nested format: { fields: {...} }
 */
export const updateRecordRequestSchema = z.object({
  fields: z.record(z.string(), fieldValueSchema).optional().default({}),
})

// ============================================================================
// Batch Operation Request Schemas
// ============================================================================

/**
 * Batch create records request schema
 *
 * Requires nested format: { fields: {...} } (Airtable style)
 */
export const batchCreateRecordsRequestSchema = z.object({
  records: z
    .array(
      z.object({
        fields: z.record(z.string(), fieldValueSchema).optional().default({}),
      })
    )
    .min(1, 'At least one record is required')
    .max(100, 'Maximum 100 records per batch'),
  returnRecords: z.boolean().optional().default(false),
})

/**
 * Batch update records request schema
 *
 * Requires nested format: { id: string, fields: {...} }
 */
export const batchUpdateRecordsRequestSchema = z.object({
  records: z
    .array(
      z.object({
        id: z
          .union([z.string().min(1, 'Record ID is required'), z.number()])
          .transform((val) => String(val)),
        fields: z.record(z.string(), fieldValueSchema).optional().default({}),
      })
    )
    .min(1, 'At least one record is required')
    .max(100, 'Maximum 100 records per batch'),
})

/**
 * Batch delete records request schema
 */
export const batchDeleteRecordsRequestSchema = z.object({
  ids: z
    .array(
      z
        .union([z.string().min(1, 'Record ID cannot be empty'), z.number()])
        .transform((val) => String(val))
    )
    .min(1, 'At least one ID is required')
    .max(100, 'Maximum 100 IDs per batch'),
})

/**
 * Batch restore records request schema
 */
export const batchRestoreRecordsRequestSchema = z.object({
  ids: z
    .array(
      z
        .union([z.string().min(1, 'Record ID cannot be empty'), z.number()])
        .transform((val) => String(val))
    )
    .min(1, 'At least one ID is required')
    .max(100, 'Maximum 100 IDs per batch'),
})

/**
 * Upsert records request schema
 *
 * Requires nested format: { fields: {...} }
 */
export const upsertRecordsRequestSchema = z.object({
  records: z
    .array(
      z.object({
        fields: z.record(z.string(), fieldValueSchema).optional().default({}),
      })
    )
    .min(1, 'At least one record is required')
    .max(100, 'Maximum 100 records per batch'),
  fieldsToMergeOn: z.array(z.string()).min(1, 'At least one merge field is required'),
  returnRecords: z.boolean().optional().default(false),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type CreateRecordRequest = z.infer<typeof createRecordRequestSchema>
export type UpdateRecordRequest = z.infer<typeof updateRecordRequestSchema>
export type BatchCreateRecordsRequest = z.infer<typeof batchCreateRecordsRequestSchema>
export type BatchUpdateRecordsRequest = z.infer<typeof batchUpdateRecordsRequestSchema>
export type BatchDeleteRecordsRequest = z.infer<typeof batchDeleteRecordsRequestSchema>
export type BatchRestoreRecordsRequest = z.infer<typeof batchRestoreRecordsRequestSchema>
export type UpsertRecordsRequest = z.infer<typeof upsertRecordsRequestSchema>
