/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { fieldValueSchema } from './tables'

// ============================================================================
// Record Request Schemas
// ============================================================================

/**
 * Wrap a flat-shape body into the canonical `{ fields: {...} }` envelope.
 *
 * Accepts both the canonical Airtable-style body (`{ fields: { ... } }`)
 * and a flat alternative (`{ title: '...', file: '...' }`) used by the
 * attachment-upload integration specs. The flat shape is detected when
 * the body is a plain object that does not contain a `fields` key.
 */
const wrapFlatFieldsBody = (input: unknown): unknown => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input
  const obj = input as Record<string, unknown>
  if ('fields' in obj) return obj
  const keys = Object.keys(obj)
  if (keys.length === 0) return obj
  return { fields: { ...obj } }
}

/**
 * Create record request schema
 *
 * Accepts both formats:
 * - Canonical: `{ fields: { name: 'value' } }`
 * - Flat: `{ name: 'value' }` (preprocessed into the canonical shape)
 */
export const createRecordRequestSchema = z.preprocess(
  wrapFlatFieldsBody,
  z.object({
    fields: z.record(z.string(), fieldValueSchema).optional().default({}),
  })
)

/**
 * Update record request schema
 *
 * Accepts both formats:
 * - Canonical: `{ fields: { name: 'value' } }`
 * - Flat: `{ name: 'value' }` (preprocessed into the canonical shape)
 */
export const updateRecordRequestSchema = z.preprocess(
  wrapFlatFieldsBody,
  z.object({
    fields: z.record(z.string(), fieldValueSchema).optional().default({}),
  })
)

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
    .max(1000, 'Maximum 1000 records per batch'),
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
  returnRecords: z.boolean().optional().default(false),
})

/**
 * Batch delete records request schema
 *
 * Optional `permanent` flag hard-deletes already soft-deleted records (admin-only
 * semantics enforced in the application layer). Accepted both in the JSON body
 * (preferred) and as the `?permanent=true` query string for route variants that
 * keep the legacy query parameter contract.
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
  permanent: z.boolean().optional(),
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
 * Accepts both `fieldsToMergeOn` and `matchFields` as aliases for the merge fields array.
 */
export const upsertRecordsRequestSchema = z.preprocess(
  (input: unknown) => {
    if (
      input !== null &&
      typeof input === 'object' &&
      'matchFields' in input &&
      !('fieldsToMergeOn' in input)
    ) {
      const { matchFields, ...rest } = input as Record<string, unknown>
      return { ...rest, fieldsToMergeOn: matchFields }
    }
    return input
  },
  z.object({
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
)

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
