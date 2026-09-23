/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { preprocessed } from '@/domain/models/api/combinators/preprocess'
import { transformed } from '@/domain/models/api/combinators/transform'
import { withDefault } from '../combinators/schema-defaults'
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
  const raw = input as Record<string, unknown>
  // An explicit `undefined` counts as ABSENT. Zod's `.default()` fired on
  // both; `Schema.withDecodingDefaultKey` fires only on a MISSING key, and
  // the difference is invisible over HTTP (JSON has no `undefined`) but real
  // for an in-process caller building the body by hand.
  const obj =
    'fields' in raw && raw['fields'] === undefined
      ? Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'fields'))
      : raw
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
export const createRecordRequestSchema = preprocessed(
  wrapFlatFieldsBody,
  Schema.Struct({
    fields: Schema.Record(Schema.String, fieldValueSchema)
      .annotate({ description: 'Field values keyed by field name' })
      .pipe(withDefault({})),
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
  const raw = input as Record<string, unknown>
  // An explicit `undefined` counts as ABSENT. Zod's `.default()` fired on
  // both; `Schema.withDecodingDefaultKey` fires only on a MISSING key, and
  // the difference is invisible over HTTP (JSON has no `undefined`) but real
  // for an in-process caller building the body by hand.
  const obj =
    'fields' in raw && raw['fields'] === undefined
      ? Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'fields'))
      : raw
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
export const updateRecordRequestSchema = preprocessed(
  wrapUpdateBody,
  Schema.Struct({
    fields: Schema.Record(Schema.String, fieldValueSchema)
      .annotate({ description: 'Field values to write; omitted fields are left unchanged' })
      .pipe(withDefault({})),
    updatedAt: optionalField(
      Schema.String.annotate({
        description:
          'Optimistic-locking token: the `updatedAt` the caller last read. A stale token is refused with 409; an absent one skips the check',
      })
    ),
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
export const batchCreateRecordsRequestSchema = Schema.Struct({
  records: Schema.Array(
    preprocessed(
      wrapFlatFieldsBody,
      Schema.Struct({
        fields: Schema.Record(Schema.String, fieldValueSchema)
          .annotate({ description: 'Field values keyed by field name' })
          .pipe(withDefault({})),
      }).annotate({
        description: 'One record of the batch. A bare map of field values is accepted too.',
      })
    )
  )
    .annotate({ description: 'Records to create, 1 to 1000 per request' })
    .pipe(
      Schema.check(
        Schema.isMinLength(1).annotate({ message: 'At least one record is required' }),
        Schema.isMaxLength(1000).annotate({ message: 'Maximum 1000 records per batch' })
      )
    ),
  returnRecords: Schema.Boolean.annotate({
    description: 'Return the affected records in the response rather than only a summary',
  }).pipe(withDefault(false)),
})

/**
 * Batch update records request schema
 *
 * Requires nested format: { id: string, fields: {...} }
 */
export const batchUpdateRecordsRequestSchema = Schema.Struct({
  records: Schema.Array(
    Schema.Struct({
      id: transformed(
        Schema.Union([
          Schema.String.pipe(
            Schema.check(Schema.isMinLength(1).annotate({ message: 'Record ID is required' }))
          ),
          Schema.Finite,
        ]),
        Schema.String,
        (val) => String(val)
      ),
      fields: Schema.Record(Schema.String, fieldValueSchema)
        .annotate({ description: 'Field values to write; omitted fields are left unchanged' })
        .pipe(withDefault({})),
    })
  )
    .annotate({ description: 'Records to update, each naming its `id`, 1 to 100 per request' })
    .pipe(
      Schema.check(
        Schema.isMinLength(1).annotate({ message: 'At least one record is required' }),
        Schema.isMaxLength(100).annotate({ message: 'Maximum 100 records per batch' })
      )
    ),
  returnRecords: Schema.Boolean.annotate({
    description: 'Return the affected records in the response rather than only a summary',
  }).pipe(withDefault(false)),
})

/**
 * Batch delete records request schema
 *
 * Optional `permanent` flag hard-deletes already soft-deleted records (admin-only
 * semantics enforced in the application layer). Accepted both in the JSON body
 * (preferred) and as the `?permanent=true` query string for route variants that
 * keep the legacy query parameter contract.
 */
export const batchDeleteRecordsRequestSchema = Schema.Struct({
  ids: Schema.Array(
    transformed(
      Schema.Union([
        Schema.String.pipe(
          Schema.check(Schema.isMinLength(1).annotate({ message: 'Record ID cannot be empty' }))
        ),
        Schema.Finite,
      ]),
      Schema.String,
      (val) => String(val)
    )
  )
    .annotate({ description: 'Identifiers of the records to delete, 1 to 100 per request' })
    .pipe(
      Schema.check(
        Schema.isMinLength(1).annotate({ message: 'At least one ID is required' }),
        Schema.isMaxLength(100).annotate({ message: 'Maximum 100 IDs per batch' })
      )
    ),
  permanent: optionalField(
    Schema.Boolean.annotate({
      description:
        'Hard-delete instead of trashing. Read from the body on this route, never from the query string. Admin only',
    })
  ),
})

/**
 * Batch restore records request schema
 */
export const batchRestoreRecordsRequestSchema = Schema.Struct({
  ids: Schema.Array(
    transformed(
      Schema.Union([
        Schema.String.pipe(
          Schema.check(Schema.isMinLength(1).annotate({ message: 'Record ID cannot be empty' }))
        ),
        Schema.Finite,
      ]),
      Schema.String,
      (val) => String(val)
    )
  )
    .annotate({ description: 'Identifiers of the records to restore, 1 to 100 per request' })
    .pipe(
      Schema.check(
        Schema.isMinLength(1).annotate({ message: 'At least one ID is required' }),
        Schema.isMaxLength(100).annotate({ message: 'Maximum 100 IDs per batch' })
      )
    ),
})

/**
 * Upsert records request schema
 *
 * Requires nested format: { fields: {...} }
 * Accepts both `fieldsToMergeOn` and `matchFields` as aliases for the merge fields array.
 */
export const upsertRecordsRequestSchema = preprocessed(
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
  Schema.Struct({
    records: Schema.Array(
      Schema.Struct({
        fields: Schema.Record(Schema.String, fieldValueSchema)
          .annotate({ description: 'Field values keyed by field name' })
          .pipe(withDefault({})),
      }).annotate({
        description: 'One record to create or update.',
      })
    )
      .annotate({ description: 'Records to create or update, 1 to 100 per request' })
      .pipe(
        Schema.check(
          Schema.isMinLength(1).annotate({ message: 'At least one record is required' }),
          Schema.isMaxLength(100).annotate({ message: 'Maximum 100 records per batch' })
        )
      ),
    fieldsToMergeOn: Schema.Array(
      Schema.String.annotate({
        description: 'One field of the merge key.',
      })
    )
      .annotate({
        description:
          'Field names forming the merge key. An existing row matching on all of them is updated, otherwise one is created. Also accepted as `matchFields`',
      })
      .pipe(
        Schema.check(
          Schema.isMinLength(1).annotate({ message: 'At least one merge field is required' })
        )
      ),
    returnRecords: Schema.Boolean.annotate({
      description: 'Return the affected records in the response rather than only the counts',
    }).pipe(withDefault(false)),
  })
)

// ============================================================================
// TypeScript Types
// ============================================================================

export type CreateRecordRequest = typeof createRecordRequestSchema.Type
export type UpdateRecordRequest = typeof updateRecordRequestSchema.Type
export type BatchCreateRecordsRequest = typeof batchCreateRecordsRequestSchema.Type
export type BatchUpdateRecordsRequest = typeof batchUpdateRecordsRequestSchema.Type
export type BatchDeleteRecordsRequest = typeof batchDeleteRecordsRequestSchema.Type
export type BatchRestoreRecordsRequest = typeof batchRestoreRecordsRequestSchema.Type
export type UpsertRecordsRequest = typeof upsertRecordsRequestSchema.Type
