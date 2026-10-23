/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
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

/**
 * CSV import request schema — `POST /api/tables/:table/records/import`.
 *
 * The grid's CSV import is a named road, not a batch call: one chunk of the
 * file's rows, and what to do with a row whose merge field matches an existing
 * one — `create` it anyway, `skip` it, or `overwrite` the match. `skip` and
 * `overwrite` need `mergeOn`. 1 to 100 rows per call, the upsert's cap.
 */
export const importRecordsRequestSchema = Schema.Struct({
  records: Schema.Array(
    Schema.Struct({
      fields: Schema.Record(Schema.String, fieldValueSchema)
        .annotate({ description: 'Field values keyed by field name' })
        .pipe(withDefault({})),
    }).annotate({ description: 'One imported row.' })
  )
    .annotate({ description: 'The rows of one import chunk, 1 to 100 per request' })
    .pipe(
      Schema.check(
        Schema.isMinLength(1).annotate({ message: 'At least one record is required' }),
        Schema.isMaxLength(100).annotate({ message: 'Maximum 100 records per import call' })
      )
    ),
  strategy: Schema.Literals(['create', 'skip', 'overwrite'])
    .annotate({
      description:
        'What to do with a row whose `mergeOn` field matches an existing record: create it anyway, skip it, or overwrite the match',
    })
    .pipe(withDefault('create' as const)),
  mergeOn: optionalField(
    Schema.String.annotate({
      description: 'The field that identifies a duplicate row; required by `skip` and `overwrite`',
    })
  ),
}).pipe(
  Schema.check(
    Schema.makeFilter((body) =>
      body.strategy !== 'create' && body.mergeOn === undefined
        ? `The ${body.strategy} strategy needs a mergeOn field`
        : undefined
    )
  )
)

/** CSV import response schema: what one import call did with its rows. */
export const importRecordsResponseSchema = Schema.Struct({
  created: Schema.Finite.annotate({ description: 'Rows created' }),
  updated: Schema.Finite.annotate({ description: 'Existing records overwritten' }),
  skipped: Schema.Finite.annotate({ description: 'Rows skipped as duplicates' }),
})

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
export type ImportRecordsRequest = typeof importRecordsRequestSchema.Type

// ---------------------------------------------------------------------------
// Access grants — the records of the engine-managed `user_access` table
// ---------------------------------------------------------------------------

/**
 * Wire contracts for the access-grant routes, `/api/tables/user_access/records`.
 *
 * A grant gives one account access to some records of one scope table
 * (`auth.scopeTables`) under one role. Every route is admin-only; a refused
 * caller is answered `404`.
 */

/** The record ids a grant names: at least one. */
const grantRecordIdsSchema = Schema.Array(
  Schema.String.annotate({ description: 'Id of a record of the scope table' })
)
  .annotate({ description: 'The records of the scope table this grant gives access to' })
  .pipe(Schema.check(Schema.isMinLength(1)))

/** The fields every grant carries, in whichever route answers it. */
const grantFields = {
  user_id: Schema.String.annotate({ description: 'The account the grant is for' }),
  table_slug: Schema.String.annotate({
    description: 'The scope table the grant covers, one of auth.scopeTables',
  }),
  record_ids: grantRecordIdsSchema,
  role: Schema.String.annotate({
    description: 'The role the account holds over those records, one of auth.roles',
  }),
  created_at: looseIsoDateTime({ description: 'ISO 8601 timestamp the grant was minted' }),
  created_by: optionalField(
    Schema.String.annotate({ description: 'The account that minted the grant' })
  ),
}

/**
 * One grant, in the record envelope every records route answers.
 *
 * Used for:
 * - POST /api/tables/user_access/records (201)
 * - GET, PATCH /api/tables/user_access/records/:id (200)
 */
export const userAccessRecordSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Unique grant identifier' }),
  fields: Schema.Struct(grantFields).annotate({ description: 'The grant itself' }),
}).annotate({ description: 'One access grant' })

export type UserAccessRecord = Schema.Schema.Type<typeof userAccessRecordSchema>

/**
 * One grant as a LISTING answers it: the grant, plus what a reader needs to
 * read it without a second request — the account's address and name, and a
 * readable label for each record it names.
 *
 * The additions are read-only and computed at read time; nothing about them is
 * stored on the grant, and a write never accepts them.
 *
 * Used for:
 * - GET /api/tables/user_access/records (each item of `records`)
 */
export const userAccessListedRecordSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Unique grant identifier' }),
  fields: Schema.Struct({
    ...grantFields,
    user_email: optionalField(
      Schema.String.annotate({
        description:
          'The email address of the account the grant is for; absent when the grant names no existing account',
      })
    ),
    user_name: optionalField(
      Schema.String.annotate({
        description:
          'The name of the account the grant is for; absent when the grant names no existing account',
      })
    ),
    record_labels: Schema.Array(
      Schema.String.annotate({
        description:
          "A record's label: the value of the scope table's first declared single-line-text field that is not write-only, or the record id when the table declares none, the value is empty, or no record of the table has that id",
      })
    ).annotate({
      description: 'One readable label per entry of record_ids, in the same order',
    }),
  }).annotate({ description: 'The grant, with its account and records made readable' }),
}).annotate({ description: 'One access grant, as a listing answers it' })

export type UserAccessListedRecord = Schema.Schema.Type<typeof userAccessListedRecordSchema>

/**
 * A list of grants.
 *
 * Used for:
 * - GET /api/tables/user_access/records — narrowed by any combination of
 *   `user_id`, `user_email` (the account with that address, matched without
 *   regard to case), `table_slug` and `record_id`; with `table_slug` and
 *   `record_id` it answers who holds a grant over one record
 */
export const userAccessListResponseSchema = Schema.Struct({
  records: Schema.Array(userAccessListedRecordSchema).annotate({
    description: 'The grants, oldest first',
  }),
}).annotate({ description: 'A list of access grants' })

export type UserAccessListResponse = Schema.Schema.Type<typeof userAccessListResponseSchema>

/**
 * A change to one grant: its records, its role, or both.
 *
 * Used for:
 * - PATCH /api/tables/user_access/records/:id
 *
 * A grant keeps its account and its table. Moving access to another account or
 * another table is a revocation followed by a new grant, so a body naming
 * `user_id` or `table_slug` is refused rather than applied.
 */
export const updateUserAccessRequestSchema = Schema.Struct({
  fields: Schema.Struct({
    record_ids: optionalField(grantRecordIdsSchema),
    role: optionalField(
      Schema.String.annotate({ description: 'The new role, one of auth.roles' }).pipe(
        Schema.check(Schema.isMinLength(1))
      )
    ),
  }).annotate({ description: 'The parts of the grant to change' }),
}).annotate({ description: 'A change to one access grant' })

export type UpdateUserAccessRequest = Schema.Schema.Type<typeof updateUserAccessRequestSchema>

/**
 * `POST /api/tables/:table/records/:id/read` — mark a parent record read.
 *
 * Moves the caller's last-read position on every `readState` relationship
 * pointing at this record to its newest child she may read. The parent's own
 * rows then carry the counts (`unreadCount`, or each relationship's `as`) in
 * their `fields`, read-only, beside its stored fields; this answer repeats
 * them as they stand after the move. A record she may not read answers 404.
 */
export const markRecordReadResponseSchema = Schema.Struct({
  recordId: Schema.String.annotate({ description: 'The parent record marked read' }),
  counts: Schema.Record(
    Schema.String,
    Schema.Int.annotate({ description: 'Unread children after the move' }).pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    )
  ).annotate({
    description:
      'Each read-state count of the record by its name (unreadCount, or the as of its relationship), after the move',
  }),
})

/** @public */
export type MarkRecordReadResponse = Schema.Schema.Type<typeof markRecordReadResponseSchema>
