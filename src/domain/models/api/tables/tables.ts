/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { FILTER_OPERATOR_VOCABULARY } from '@/domain/models/app/tables/closed-vocabulary'
import { paginationSchema, timestampSchema } from '../_shared/common'

/**
 * One condition of a view filter, as this API SERIALISES it.
 *
 * `operator` mirrors `FILTER_OPERATOR_VOCABULARY` — the same closed set
 * `ViewFilterConditionSchema` enforces on `tables[].views[].filters` — rather
 * than restating the terms, so the two cannot drift apart. Drift is the whole
 * reason that vocabulary was closed: `operator` was a bare `Schema.String`
 * whose unknown values fell through `generateSqlCondition` to `field = value`.
 *
 * Mirroring is safe here because this schema only ever SERIALISES. `runEffect`
 * applies it to a program's output, never to a request body; the three
 * `/api/tables/:tableId/views*` routes are all GET; and `getViewProgram` reads
 * `app.tables[].views[]` straight off the decoded config. So every operator
 * that can reach this point has already passed the stricter AppSchema check,
 * and the enum can reject nothing that the engine currently emits — it just
 * makes "valid in the config, invalid in the response contract" unrepresentable.
 */
const viewFilterConditionResponseSchema = z.object({
  field: z.string(),
  operator: z.enum(FILTER_OPERATOR_VOCABULARY.terms as readonly [string, ...string[]]),
  value: z.unknown(),
})

/**
 * A view filter node, as this API serialises it — the response-side mirror of
 * `ViewFilterNodeSchema`.
 *
 * FOUR SHAPES, NOT ONE. The config schema is a three-arm union whose group arms
 * recurse through `Schema.suspend`: a bare condition, `{ and: [...] }`,
 * `{ or: [...] }`, and either group holding another group. This used to be
 * modelled as a single `z.object({ and?: cond[], or?: cond[] })` — only the flat
 * middle of that space — and the two arms it omitted broke DIFFERENTLY:
 *
 *   - a BARE condition parsed to `{}`. Zod strips what an object schema does not
 *     name, so `field` / `operator` / `value` were removed on the way out and the
 *     endpoint answered 200 describing a view that looked unfiltered. A client
 *     building a filter UI from it would offer to add the first filter to a view
 *     that already had one.
 *   - a NESTED group threw at the route boundary, because every element of `and`
 *     was typed as a flat condition and a nested `{ or: [...] }` has no `field`.
 *
 * `z.lazy` mirrors the config schema's own `Schema.suspend`, so nesting survives
 * to arbitrary depth rather than to some fixed number of levels.
 */
type ViewFilterNodeResponse =
  | { readonly field: string; readonly operator: string; readonly value?: unknown }
  | { readonly and: readonly ViewFilterNodeResponse[] }
  | { readonly or: readonly ViewFilterNodeResponse[] }

// The explicit annotation is what makes the recursion typeable — TypeScript
// cannot infer the type of a schema that references itself. `z.ZodType` is a
// mutable third-party class with no readonly counterpart, so it cannot satisfy
// `prefer-immutable-types`; the same exemption is already made for the mutable
// `OpenAPIHono` type in [internal ref].
// eslint-disable-next-line functional/prefer-immutable-types
const viewFilterNodeResponseSchema: z.ZodType<ViewFilterNodeResponse> = z
  .lazy(() =>
    z.union([
      viewFilterConditionResponseSchema,
      z.object({ and: z.array(viewFilterNodeResponseSchema) }),
      z.object({ or: z.array(viewFilterNodeResponseSchema) }),
    ])
  )
  // The `.openapi()` ref id is REQUIRED, not decorative. Without a registered
  // ref, `zod-to-openapi` inlines a `z.lazy` schema by walking into it forever
  // and `GET /api/openapi.json` dies with
  // `RangeError: Maximum call stack size exceeded` — a 500 on the whole
  // document, not just this node. The ref makes the recursion a `$ref` cycle,
  // which is what OpenAPI expresses recursion with.
  .openapi('ViewFilterNode') as z.ZodType<ViewFilterNodeResponse>

// ============================================================================
// Field Schemas
// ============================================================================

/**
 * Base field schema
 *
 * Common properties for all field types.
 */
export const baseFieldSchema = z
  .object({
    id: z.string().describe('Field identifier'),
    name: z.string().describe('Field name'),
    type: z.string().describe('Field type'),
    required: z.boolean().optional().describe('Whether field is required'),
    unique: z.boolean().optional().describe('Whether field must be unique'),
    indexed: z.boolean().optional().describe('Whether field is indexed'),
    description: z.string().optional().describe('Field description'),
  })
  .openapi('Field')

/**
 * Field value schema (for record data)
 *
 * Represents a value in a record field.
 */
export const fieldValueSchema = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()).readonly(),
    z.record(z.string(), z.unknown()),
  ])
  .openapi('FieldValue')

/**
 * Formatted field value schema (for display formatting)
 *
 * When format=display is requested, fields may include both value and displayValue.
 */
export const formattedFieldValueSchema = z
  .union([
    fieldValueSchema,
    z.object({
      value: fieldValueSchema,
      displayValue: z.string().optional(),
    }),
  ])
  .openapi('FormattedFieldValue')

// ============================================================================
// Table Schemas
// ============================================================================

/**
 * Table schema
 *
 * Represents a table definition in API responses.
 */
export const tableSchema = z
  .object({
    id: z.string().describe('Table identifier'),
    name: z.string().describe('Table name'),
    description: z.string().optional().describe('Table description'),
    fields: z.array(baseFieldSchema).describe('Table fields'),
    primaryKey: z.string().optional().describe('Primary key field'),
    views: z.array(z.unknown()).describe('Table views'),
    permissions: z
      .object({
        read: z
          .union([z.array(z.string()).readonly(), z.literal('all'), z.literal('authenticated')])
          .optional(),
        create: z
          .union([z.array(z.string()).readonly(), z.literal('all'), z.literal('authenticated')])
          .optional(),
        update: z
          .union([z.array(z.string()).readonly(), z.literal('all'), z.literal('authenticated')])
          .optional(),
        delete: z
          .union([z.array(z.string()).readonly(), z.literal('all'), z.literal('authenticated')])
          .optional(),
      })
      .optional()
      .describe('Table permissions'),
  })
  .extend(timestampSchema.shape)
  .openapi('Table')

/**
 * Table summary schema (for list endpoints)
 */
export const tableSummarySchema = z
  .object({
    id: z.string().describe('Table identifier'),
    name: z.string().describe('Table name'),
    description: z.string().optional().describe('Table description'),
    fieldCount: z.number().describe('Number of fields'),
    recordCount: z.number().optional().describe('Number of records'),
  })
  .extend(timestampSchema.shape)
  .openapi('TableSummary')

// ============================================================================
// Record Schemas
// ============================================================================

/**
 * Per-field AI-compute refinement status ([internal ref] Phase 2).
 *
 * An AI-computed value resolves in two tiers: a deterministic baseline written
 * synchronously, then a provider refinement. When the refinement never lands,
 * the baseline SURVIVES as the stored value — honest, plausible-looking content
 * that is indistinguishable from a refined one. This block is what tells the
 * two apart, so it is part of the record contract rather than an incidental
 * extra: `status` is the lifecycle state, `error` the recorded provider reason.
 */
const aiComputeFieldStatusSchema = z.object({
  status: z.string().describe('pending | refined | failed | skipped'),
  error: z.string().optional().describe('Recorded provider failure reason'),
})

/**
 * The `_aiCompute` block: one status entry per AI-compute field. Omitted
 * entirely for a table that declares no AI-compute field, and for a record with
 * no status rows yet — never sent as an empty object.
 */
export const aiComputeProjectionSchema = z
  .record(z.string(), aiComputeFieldStatusSchema)
  .describe('AI-compute refinement status, keyed by field name')

/**
 * The `_display` block: the human label behind a relationship column's stored
 * key, for every column whose field declared a `displayField`.
 *
 * A string for a to-one column, a list for a to-many one, so a consumer can
 * tell a single link from many without re-reading the schema. Omitted entirely
 * when a record references nothing labellable, and never sent as an empty
 * object. It sits BESIDE `fields` rather than replacing anything in it: the
 * stored key stays exactly where it was, so filters, editors and the write path
 * are unaffected.
 */
export const displayLabelsSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .describe('Resolved relationship labels, keyed by field name')

/**
 * Record schema (Airtable-style)
 *
 * Represents a record in a table.
 * User-defined fields are nested under the `fields` property.
 * System fields (id, createdAt, updatedAt) remain at root level.
 *
 * `_aiCompute` and `_display` are declared EXPLICITLY rather than admitted by
 * `.passthrough()`. A bare `z.object()` strips what it does not name, and
 * `runEffect` parses every list response through this schema — so a block that
 * is not named here is removed at the route boundary, silently and with nothing
 * logged. Naming one both keeps it on the wire and publishes it in the OpenAPI
 * document.
 */
export const recordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).describe('Record identifier'),
    fields: z
      .record(z.string(), formattedFieldValueSchema)
      .describe('User-defined field values (may include display formatting)'),
    createdBy: z.string().optional().describe('User who created the record'),
    updatedBy: z.string().optional().describe('User who last updated the record'),
    deletedBy: z.string().optional().describe('User who deleted the record'),
    _aiCompute: aiComputeProjectionSchema.optional(),
    _display: displayLabelsSchema.optional(),
  })
  .extend(timestampSchema.shape)
  .openapi('Record')

// ============================================================================
// Table API Response Schemas
// ============================================================================

/**
 * List tables response schema
 */
export const listTablesResponseSchema = z.object({
  tables: z.array(tableSummarySchema).describe('List of tables'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
})

/**
 * Get table response schema
 */
export const getTableResponseSchema = z.object({
  table: tableSchema.describe('Table details'),
})

// ============================================================================
// Record API Response Schemas
// ============================================================================

/**
 * Aggregation values can be either a flat numeric result (shortcut form with a
 * single aggregated field, e.g. `?aggregate=amount:sum`) or a per-field record
 * (JSON form or multi-field shortcut).
 */
const aggregationValueSchema = z.union([z.number(), z.record(z.string(), z.number())])

const aggregationsSchema = z
  .object({
    count: z
      .union([z.string(), z.number()])
      .optional()
      .describe('Total count of records (flat number for shortcut form, string otherwise)'),
    sum: aggregationValueSchema.optional().describe('Sum aggregation(s)'),
    avg: aggregationValueSchema.optional().describe('Average aggregation(s)'),
    min: aggregationValueSchema.optional().describe('Minimum aggregation(s)'),
    max: aggregationValueSchema.optional().describe('Maximum aggregation(s)'),
  })
  .describe('Aggregation results')

/**
 * List records response schema
 */
export const listRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('List of records'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
  aggregations: aggregationsSchema.optional(),
  groups: z
    .array(
      z.object({
        name: z.union([z.string(), z.null()]).describe('Group value from the groupBy field'),
        // A group's own value stops being a key the moment `groupBy` names more
        // than one field: two regions can each hold a `Prospect` group, so a
        // count carrying only `name` cannot say which one it describes. `path`
        // carries the value at every level, outermost first, ending in `name`.
        // A one-field `groupBy` returns single-entry paths and every reader that
        // keys on `name` alone is unaffected.
        path: z
          .array(z.string())
          .optional()
          .describe('Group values from the outermost level down to this one'),
        count: z.number().describe('Number of records in group'),
        aggregations: aggregationsSchema.optional(),
      })
    )
    .optional()
    .describe(
      'Grouped results when groupBy is provided — one entry per group at EVERY named level'
    ),
})

/**
 * Get record response schema
 *
 * Returns record in flattened format (id, fields, timestamps, authorship at root level)
 * to match test expectations and provide consistent API response structure.
 */
export const getRecordResponseSchema = z
  .object({
    id: z.union([z.string(), z.number()]).describe('Record identifier'),
    fields: z
      .record(z.string(), formattedFieldValueSchema)
      .describe('User-defined field values (may include display formatting)'),
    createdBy: z.string().optional().describe('User who created the record'),
    updatedBy: z.string().optional().describe('User who last updated the record'),
    deletedBy: z.string().optional().describe('User who deleted the record'),
  })
  .extend(timestampSchema.shape)
  // Allow per-field root-level aliases (e.g. record.file alongside record.fields.file).
  .passthrough()

/**
 * Create record response schema
 *
 * Returns record with the canonical shape (id, fields, timestamps at root)
 * AND a flat alias of each user-defined field at the root, e.g. for a record
 * `{ fields: { title: 'Q1 Report', file: 'key' } }` the response also
 * includes `title` and `file` at the root. This lets clients address fields
 * either via `record.fields.<name>` (canonical) or `record.<name>` (flat).
 */
export const createRecordResponseSchema = z
  .object({
    id: z.string().describe('Record identifier'),
    fields: z.record(z.string(), fieldValueSchema).describe('User-defined field values'),
    createdBy: z.string().optional().describe('User who created the record'),
    updatedBy: z.string().optional().describe('User who last updated the record'),
  })
  .extend(timestampSchema.shape)
  // Allow per-field root-level aliases (e.g. record.title alongside record.fields.title).
  .passthrough()

/**
 * Update record response schema
 */
export const updateRecordResponseSchema = z.object({
  record: recordSchema.describe('Updated record'),
})

/**
 * Delete record response schema
 */
export const deleteRecordResponseSchema = z.object({
  success: z.literal(true).describe('Record deleted'),
})

/**
 * Restore record response schema
 */
export const restoreRecordResponseSchema = z.object({
  success: z.literal(true).describe('Record restored'),
  record: recordSchema.describe('Restored record'),
})

// ============================================================================
// Batch Operation Schemas
// ============================================================================

/**
 * Batch create records response schema
 */
export const batchCreateRecordsResponseSchema = z.object({
  created: z.number().describe('Number of records created'),
  records: z
    .array(recordSchema)
    .optional()
    .describe('Created records (only if returnRecords=true)'),
})

/**
 * Batch update records response schema
 */
export const batchUpdateRecordsResponseSchema = z.object({
  updated: z.number().describe('Number of records updated'),
  records: z
    .array(recordSchema)
    .optional()
    .describe('Updated records (only if returnRecords=true)'),
})

/**
 * Batch delete records response schema
 */
export const batchDeleteRecordsResponseSchema = z.object({
  deleted: z.number().describe('Number of records deleted'),
})

/**
 * Batch restore records response schema
 */
export const batchRestoreRecordsResponseSchema = z.object({
  success: z.literal(true).describe('Batch restore succeeded'),
  restored: z.number().describe('Number of records restored'),
})

/**
 * Upsert records response schema
 */
export const upsertRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('Upserted records'),
  created: z.number().describe('Number of records created'),
  updated: z.number().describe('Number of records updated'),
})

// ============================================================================
// View Schemas
// ============================================================================

/**
 * View schema
 */
export const viewSchema = z
  .object({
    id: z.string().describe('View identifier'),
    name: z.string().describe('View name'),
    tableId: z.string().describe('Parent table ID'),
    fields: z.array(z.string()).optional().describe('Visible field IDs'),
    filters: z.array(z.unknown()).optional().describe('View filters'),
    sorts: z.array(z.unknown()).optional().describe('View sorts'),
    groupBy: z.string().optional().describe('Group by field'),
  })
  .extend(timestampSchema.shape)
  .openapi('View')

/**
 * List views response schema
 */
export const listViewsResponseSchema = z.object({
  views: z.array(viewSchema).describe('List of views'),
})

/**
 * Get view response schema
 * Returns view properties directly at root level
 */
export const getViewResponseSchema = z.object({
  id: z.string().describe('View identifier'),
  name: z.string().describe('View name'),
  filters: viewFilterNodeResponseSchema.optional().describe('View filters'),
  sorts: z
    .array(
      z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      })
    )
    .optional()
    .describe('View sorts'),
  fields: z.array(z.string()).optional().describe('Visible field names'),
  groupBy: z
    .object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']).optional(),
    })
    .optional()
    .describe('Group by configuration'),
  isDefault: z.boolean().optional().describe('Whether this is the default view'),
})

/**
 * Get view records response schema
 */
export const getViewRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('Records matching view'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
})

// ============================================================================
// Permission Schemas
// ============================================================================

/**
 * Table permission schema
 */
export const tablePermissionSchema = z
  .object({
    read: z.boolean().describe('Can read records'),
    create: z.boolean().describe('Can create records'),
    update: z.boolean().describe('Can update records'),
    delete: z.boolean().describe('Can delete records'),
    manage: z.boolean().describe('Can manage table schema'),
  })
  .openapi('TablePermission')

/**
 * Field permission schema
 */
export const fieldPermissionSchema = z
  .object({
    read: z.boolean().describe('Can read field'),
    write: z.boolean().describe('Can write field'),
  })
  .openapi('FieldPermission')

/**
 * Get table permissions response schema
 */
export const getTablePermissionsResponseSchema = z.object({
  table: z
    .object({
      read: z.boolean().describe('Can read records'),
      create: z.boolean().describe('Can create records'),
      update: z.boolean().describe('Can update records'),
      delete: z.boolean().describe('Can delete records'),
    })
    .describe('Table-level permissions'),
  fields: z.record(z.string(), fieldPermissionSchema).describe('Field-level permissions'),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type BaseField = z.infer<typeof baseFieldSchema>
export type FieldValue = z.infer<typeof fieldValueSchema>
export type Table = z.infer<typeof tableSchema>
export type TableSummary = z.infer<typeof tableSummarySchema>
export type Record = z.infer<typeof recordSchema>
/** @public */
export type View = z.infer<typeof viewSchema>
export type TablePermission = z.infer<typeof tablePermissionSchema>
export type ListTablesResponse = z.infer<typeof listTablesResponseSchema>
export type GetTableResponse = z.infer<typeof getTableResponseSchema>
export type ListRecordsResponse = z.infer<typeof listRecordsResponseSchema>
export type GetRecordResponse = z.infer<typeof getRecordResponseSchema>
export type RestoreRecordResponse = z.infer<typeof restoreRecordResponseSchema>
export type BatchRestoreRecordsResponse = z.infer<typeof batchRestoreRecordsResponseSchema>
