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
 * Wrap a flat-shape body into the canonical `{ fields: {...} }` envelope,
 * preserving a top-level `updatedAt` optimistic-locking token.
 *
 * Update requests may carry an optional `updatedAt` alongside the field
 * map. When the body is flat (`{ title: '...', updatedAt: '...' }`),
 * `updatedAt` is lifted out of the field map so it stays a sibling of
 * `fields` rather than being treated as a record field.
 */
const wrapUpdateBody = (input: unknown): unknown => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input
  const obj = input as Record<string, unknown>
  if ('fields' in obj) return obj
  const { updatedAt, ...rest } = obj
  if (Object.keys(rest).length === 0) {
    return updatedAt === undefined ? obj : { fields: {}, updatedAt }
  }
  return updatedAt === undefined ? { fields: { ...rest } } : { fields: { ...rest }, updatedAt }
}

/**
 * Update record request schema
 *
 * Accepts both formats:
 * - Canonical: `{ fields: { name: 'value' } }`
 * - Flat: `{ name: 'value' }` (preprocessed into the canonical shape)
 *
 * The optional `updatedAt` token enables optimistic-locking: when present
 * the API compares it against the stored record's `updated_at` and rejects
 * the write with 409 Conflict if they diverge (stale write detection).
 */
export const updateRecordRequestSchema = z.preprocess(
  wrapUpdateBody,
  z.object({
    fields: z.record(z.string(), fieldValueSchema).optional().default({}),
    updatedAt: z.string().optional(),
  })
)

// ============================================================================
// Batch Operation Request Schemas
// ============================================================================

/**
 * Batch create records request schema
 *
 * Each entry accepts the same two shapes single-record create accepts:
 * - Canonical: `{ fields: { name: 'value' } }` (Airtable style)
 * - Flat: `{ name: 'value' }` (preprocessed into the canonical shape)
 *
 * Accepting the flat entry is what makes the two create endpoints agree. While
 * only the canonical shape was recognised, a flat entry did not fail — it
 * decoded to `{ fields: {} }`, so a bulk import answered `201 { created: 0 }`
 * and wrote nothing, with no signal that the payload had been misread. A caller
 * who learned the flat shape from `POST /records` had no way to discover the
 * batch endpoint was discarding it.
 */
export const batchCreateRecordsRequestSchema = z.object({
  records: z
    .array(
      z.preprocess(
        wrapFlatFieldsBody,
        z.object({
          fields: z.record(z.string(), fieldValueSchema).optional().default({}),
        })
      )
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
