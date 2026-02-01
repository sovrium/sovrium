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
 * Supports two formats:
 * 1. Nested format: { fields: {...} }
 * 2. Flat format: { ...fields } (transformed to nested)
 *
 * Schemas are mutually exclusive: flat format explicitly excludes 'fields' key.
 */
export const createRecordRequestSchema = z.union([
  // Format 1: Nested format with 'fields' property (strict: only 'fields' key allowed)
  z
    .object({
      fields: z.record(z.string(), fieldValueSchema).optional().default({}),
    })
    .strict(), // Reject extra keys to prevent flat format from matching this branch
  // Format 2: Flat format (any object WITHOUT 'fields' key)
  z
    .record(z.string(), fieldValueSchema)
    .refine((data) => !('fields' in data), {
      message: 'Flat format should not contain a "fields" key',
    })
    .transform((data) => ({
      fields: data,
    })),
])

/**
 * Update record request schema
 *
 * Validates the request body for updating a record.
 * Supports two formats:
 * 1. Nested format: { fields: {...} } (Airtable style)
 * 2. Flat format: { ...fields } (transformed to nested)
 *
 * Schemas are mutually exclusive: flat format explicitly excludes 'fields' key.
 */
export const updateRecordRequestSchema = z.union([
  // Format 1: Nested format with 'fields' property (Airtable style)
  z
    .object({
      fields: z.record(z.string(), fieldValueSchema).optional().default({}),
    })
    .strict(), // Reject extra keys to prevent flat format from matching this branch
  // Format 2: Flat format (any object WITHOUT 'fields' key)
  z
    .record(z.string(), fieldValueSchema)
    .refine((data) => !('fields' in data), {
      message: 'Flat format should not contain a "fields" key',
    })
    .transform((data) => ({
      fields: data,
    })),
])

// ============================================================================
// Batch Operation Request Schemas
// ============================================================================

/**
 * Batch create records request schema
 *
 * Supports two formats for each record:
 * 1. Nested format: { fields: {...} } (Airtable style)
 * 2. Flat format: { ...fields } (transformed to nested)
 *
 * Schemas are mutually exclusive: flat format explicitly excludes 'fields' key.
 */
export const batchCreateRecordsRequestSchema = z.object({
  records: z
    .array(
      z.union([
        // Format 1: Nested format with 'fields' property (Airtable style)
        z
          .object({
            fields: z.record(z.string(), fieldValueSchema).optional().default({}),
          })
          .strict(),
        // Format 2: Flat format (any object WITHOUT 'fields' key)
        z
          .record(z.string(), fieldValueSchema)
          .refine((data) => !('fields' in data), {
            message: 'Flat format should not contain a "fields" key',
          })
          .transform((data) => ({
            fields: data,
          })),
      ])
    )
    .min(1, 'At least one record is required')
    .max(100, 'Maximum 100 records per batch'),
  returnRecords: z.boolean().optional().default(false),
})

/**
 * Batch update records request schema
 *
 * Supports two formats:
 * 1. Nested format: { id: string, fields: {...} }
 * 2. Flat format: { id: string|number, ...otherFields }
 */
export const batchUpdateRecordsRequestSchema = z.object({
  records: z
    .array(
      z.union([
        // Format 1: Nested format with fields object (backward compatibility)
        z.object({
          id: z
            .union([z.string().min(1, 'Record ID is required'), z.number()])
            .transform((val) => String(val)),
          fields: z.record(z.string(), fieldValueSchema).optional().default({}),
        }),
        // Format 2: Flat format with id and other fields at same level
        z
          .intersection(
            z.object({
              id: z
                .union([z.string().min(1, 'Record ID is required'), z.number()])
                .transform((val) => String(val)),
            }),
            z.record(z.string(), fieldValueSchema)
          )
          .transform((data) => {
            // Transform flat format to nested format for consistency
            const { id, ...fields } = data
            return { id, fields }
          }),
      ])
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
 * Supports two formats for records:
 * 1. Nested format: { fields: {...} }
 * 2. Flat format: { ...fields } (transformed to nested)
 */
export const upsertRecordsRequestSchema = z.object({
  records: z
    .array(
      z.union([
        // Format 1: Nested format with 'fields' property
        z
          .object({
            fields: z.record(z.string(), fieldValueSchema).optional().default({}),
          })
          .strict(),
        // Format 2: Flat format (any object WITHOUT 'fields' key)
        z
          .record(z.string(), fieldValueSchema)
          .refine((data) => !('fields' in data), {
            message: 'Flat format should not contain a "fields" key',
          })
          .transform((data) => ({
            fields: data,
          })),
      ])
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
