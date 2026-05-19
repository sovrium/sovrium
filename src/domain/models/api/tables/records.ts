/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { fieldValueSchema } from './tables'


const wrapFlatFieldsBody = (input: unknown): unknown => {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input
  const obj = input as Record<string, unknown>
  if ('fields' in obj) return obj
  const keys = Object.keys(obj)
  if (keys.length === 0) return obj
  return { fields: { ...obj } }
}

export const createRecordRequestSchema = z.preprocess(
  wrapFlatFieldsBody,
  z.object({
    fields: z.record(z.string(), fieldValueSchema).optional().default({}),
  })
)

export const updateRecordRequestSchema = z.preprocess(
  wrapFlatFieldsBody,
  z.object({
    fields: z.record(z.string(), fieldValueSchema).optional().default({}),
  })
)


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


export type CreateRecordRequest = z.infer<typeof createRecordRequestSchema>
export type UpdateRecordRequest = z.infer<typeof updateRecordRequestSchema>
export type BatchCreateRecordsRequest = z.infer<typeof batchCreateRecordsRequestSchema>
export type BatchUpdateRecordsRequest = z.infer<typeof batchUpdateRecordsRequestSchema>
export type BatchDeleteRecordsRequest = z.infer<typeof batchDeleteRecordsRequestSchema>
export type BatchRestoreRecordsRequest = z.infer<typeof batchRestoreRecordsRequestSchema>
export type UpsertRecordsRequest = z.infer<typeof upsertRecordsRequestSchema>
