/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { describedRef } from '@/domain/models/api/combinators/described-ref'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { FILTER_OPERATOR_VOCABULARY } from '@/domain/models/app/tables/closed-vocabulary'
import { paginationSchema, timestampSchema } from '../combinators/common'
import { appliedQuerySchema } from '../combinators/search'

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
const viewFilterConditionResponseSchema = Schema.Struct({
  field: Schema.String,
  operator: Schema.Literals(FILTER_OPERATOR_VOCABULARY.terms as readonly [string, ...string[]]),
  value: optionalField(Schema.Unknown),
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
// cannot infer the type of a schema that references itself.
//
// The `identifier` is REQUIRED, not decorative. Without it a self-referencing
// schema is inlined by walking into it forever, and `GET /api/openapi.json`
// dies with `RangeError: Maximum call stack size exceeded` — a 500 on the whole
// document, not just this node. The identifier makes the recursion a `$ref`
// cycle, which is what OpenAPI expresses recursion with.
const viewFilterNodeResponseSchema: Schema.Codec<ViewFilterNodeResponse> = Schema.suspend(
  (): Schema.Codec<ViewFilterNodeResponse> =>
    Schema.Union([
      viewFilterConditionResponseSchema,
      Schema.Struct({ and: Schema.Array(viewFilterNodeResponseSchema) }),
      Schema.Struct({ or: Schema.Array(viewFilterNodeResponseSchema) }),
    ]) as never
).annotate({ identifier: 'ViewFilterNode', description: 'View filters' })

// ============================================================================
// Field Schemas
// ============================================================================

/**
 * Base field schema
 *
 * Common properties for all field types.
 */
export const baseFieldSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Field identifier' }),
  name: Schema.String.annotate({ description: 'Field name' }),
  type: Schema.String.annotate({ description: 'Field type' }),
  required: optionalField(Schema.Boolean.annotate({ description: 'Whether field is required' })),
  unique: optionalField(Schema.Boolean.annotate({ description: 'Whether field must be unique' })),
  indexed: optionalField(Schema.Boolean.annotate({ description: 'Whether field is indexed' })),
  description: optionalField(Schema.String.annotate({ description: 'Field description' })),
}).annotate({ identifier: 'Field' })

/**
 * Field value schema (for record data)
 *
 * Represents a value in a record field.
 */
/** The member list, shared so a nesting union can SPREAD it. */
const fieldValueMembers = [
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.Unknown),
  Schema.Record(Schema.String, Schema.Unknown),
] as const

export const fieldValueSchema = Schema.Union([...fieldValueMembers]).annotate({
  identifier: 'FieldValue',
})

/**
 * Formatted field value schema (for display formatting)
 *
 * When format=display is requested, fields may include both value and displayValue.
 */
export const formattedFieldValueSchema = Schema.Union([
  ...fieldValueMembers,
  Schema.Struct({
    value: fieldValueSchema,
    displayValue: optionalField(Schema.String),
  }),
]).annotate({ identifier: 'FormattedFieldValue' })

// ============================================================================
// Table Schemas
// ============================================================================

/**
 * Table schema
 *
 * Represents a table definition in API responses.
 */
export const tableSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Table identifier' }),
    name: Schema.String.annotate({ description: 'Table name' }),
    description: optionalField(Schema.String.annotate({ description: 'Table description' })),
    fields: Schema.Array(baseFieldSchema).annotate({ description: 'Table fields' }),
    primaryKey: optionalField(Schema.String.annotate({ description: 'Primary key field' })),
    views: Schema.Array(Schema.Unknown).annotate({ description: 'Table views' }),
    permissions: optionalField(
      Schema.Struct({
        read: optionalField(
          Schema.Union([
            Schema.Array(Schema.String),
            Schema.Literal('all'),
            Schema.Literal('authenticated'),
          ])
        ),
        create: optionalField(
          Schema.Union([
            Schema.Array(Schema.String),
            Schema.Literal('all'),
            Schema.Literal('authenticated'),
          ])
        ),
        update: optionalField(
          Schema.Union([
            Schema.Array(Schema.String),
            Schema.Literal('all'),
            Schema.Literal('authenticated'),
          ])
        ),
        delete: optionalField(
          Schema.Union([
            Schema.Array(Schema.String),
            Schema.Literal('all'),
            Schema.Literal('authenticated'),
          ])
        ),
      }).annotate({ description: 'Table permissions' })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'Table' })

/**
 * Table summary schema (for list endpoints)
 */
export const tableSummarySchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Table identifier' }),
    name: Schema.String.annotate({ description: 'Table name' }),
    description: optionalField(Schema.String.annotate({ description: 'Table description' })),
    fieldCount: Schema.Finite.annotate({ description: 'Number of fields' }),
    recordCount: optionalField(Schema.Finite.annotate({ description: 'Number of records' })),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'TableSummary' })

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
const aiComputeFieldStatusSchema = Schema.Struct({
  status: Schema.String.annotate({ description: 'pending | refined | failed | skipped' }),
  error: optionalField(Schema.String.annotate({ description: 'Recorded provider failure reason' })),
})

/**
 * The `_aiCompute` block: one status entry per AI-compute field. Omitted
 * entirely for a table that declares no AI-compute field, and for a record with
 * no status rows yet — never sent as an empty object.
 */
export const aiComputeProjectionSchema = Schema.Record(
  Schema.String,
  aiComputeFieldStatusSchema
).annotate({ description: 'AI-compute refinement status, keyed by field name' })

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
export const displayLabelsSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Array(Schema.String)])
).annotate({ description: 'Resolved relationship labels, keyed by field name' })

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
export const recordSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.Union([Schema.String, Schema.Finite]).annotate({ description: 'Record identifier' }),
    fields: Schema.Record(Schema.String, formattedFieldValueSchema).annotate({
      description: 'User-defined field values (may include display formatting)',
    }),
    createdBy: optionalField(
      Schema.String.annotate({ description: 'User who created the record' })
    ),
    updatedBy: optionalField(
      Schema.String.annotate({ description: 'User who last updated the record' })
    ),
    deletedBy: optionalField(
      Schema.String.annotate({ description: 'User who deleted the record' })
    ),
    _aiCompute: optionalField(aiComputeProjectionSchema),
    _display: optionalField(displayLabelsSchema),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'Record' })

// ============================================================================
// Table API Response Schemas
// ============================================================================

/**
 * List tables response schema
 */
export const listTablesResponseSchema = Schema.Struct({
  tables: Schema.Array(tableSummarySchema).annotate({ description: 'List of tables' }),
  pagination: optionalField(paginationSchema.annotate({ description: 'Pagination metadata' })),
})

/**
 * Get table response schema
 */
export const getTableResponseSchema = Schema.Struct({
  table: tableSchema.annotate({ description: 'Table details' }),
})

// ============================================================================
// Record API Response Schemas
// ============================================================================

/**
 * Aggregation values can be either a flat numeric result (shortcut form with a
 * single aggregated field, e.g. `?aggregate=amount:sum`) or a per-field record
 * (JSON form or multi-field shortcut).
 */
const aggregationValueSchema = Schema.Union([
  Schema.Finite,
  Schema.Record(Schema.String, Schema.Finite),
])

const aggregationsSchema = Schema.Struct({
  count: optionalField(
    Schema.Union([Schema.String, Schema.Finite]).annotate({
      description: 'Total count of records (flat number for shortcut form, string otherwise)',
    })
  ),
  sum: optionalField(aggregationValueSchema.annotate({ description: 'Sum aggregation(s)' })),
  avg: optionalField(aggregationValueSchema.annotate({ description: 'Average aggregation(s)' })),
  min: optionalField(aggregationValueSchema.annotate({ description: 'Minimum aggregation(s)' })),
  max: optionalField(aggregationValueSchema.annotate({ description: 'Maximum aggregation(s)' })),
}).annotate({ description: 'Aggregation results' })

/**
 * List records response schema
 *
 * ## Why this carries `appliedQuery`
 *
 * `?q=` is honoured server-side on this route (`buildSearchFilter`, called
 * unconditionally from `prepareListRequest`) — but the response never said so,
 * and the data-table island reads that declaration BY KEY PRESENCE to decide
 * whether to narrow the page again in memory
 * (`use-island-setup.ts` → `serverFiltered: data?.appliedQuery !== undefined`).
 * With the key absent, every DB-table grid filtered a page the server had
 * already filtered.
 *
 * The second filter can only ever REMOVE rows the server matched, and it runs
 * over the RENDERED columns only — so a row matched on a field the grid does
 * not show as a column was silently discarded. Measured on a 31-row catalogue
 * whose grid declared `columns: [{ field: 'name' }]`: searching a SKU fragment
 * returned the one matching row from the server and rendered
 * "No records found".
 *
 * `appliedQuerySchema` is the SHARED three-state contract already carried by
 * `/api/admin/users`, `/api/admin/buckets/:name/files` and
 * `/api/admin/agents/:name/conversations` — imported rather than restated so
 * one search box cannot mean three things. See
 * `src/domain/models/api/combinators/search.ts` for the state table; the emission
 * rules THIS route must satisfy are:
 *
 * | Branch                                        | `appliedQuery`     |
 * |-----------------------------------------------|--------------------|
 * | list with a term (`?q=Zinc`)                  | `'Zinc'` (trimmed) |
 * | list with no term / empty / whitespace-only   | `null`             |
 * | list short-circuited to `EMPTY_LIST_RESPONSE` | `null`             |
 * | trash (`?deleted=true` → `handleListTrash`)   | key ABSENT         |
 *
 * The trash row is not an oversight: `handleListTrash` never calls
 * `buildSearchFilter` and ignores `?q=` outright, so it must keep the client
 * filtering. Presence is read per RESPONSE, which is exactly what lets one
 * route hold a searching branch and a non-searching branch at once.
 */
export const listRecordsResponseSchema = Schema.Struct({
  records: Schema.Array(recordSchema).annotate({ description: 'List of records' }),
  pagination: optionalField(paginationSchema.annotate({ description: 'Pagination metadata' })),
  appliedQuery: appliedQuerySchema,
  aggregations: optionalField(aggregationsSchema),
  groups: optionalField(
    Schema.Array(
      Schema.Struct({
        name: Schema.Union([Schema.String, Schema.Null]).annotate({
          description: 'Group value from the groupBy field',
        }),
        path: optionalField(
          Schema.Array(Schema.String).annotate({
            description: 'Group values from the outermost level down to this one',
          })
        ),
        count: Schema.Finite.annotate({ description: 'Number of records in group' }),
        aggregations: optionalField(aggregationsSchema),
      })
    ).annotate({
      description:
        'Grouped results when groupBy is provided — one entry per group at EVERY named level',
    })
  ),
})

/**
 * Get record response schema
 *
 * Returns record in flattened format (id, fields, timestamps, authorship at root level)
 * to match test expectations and provide consistent API response structure.
 */
export const getRecordResponseSchema = Schema.StructWithRest(
  Schema.Struct({
    ...Schema.Struct({
      id: Schema.Union([Schema.String, Schema.Finite]).annotate({
        description: 'Record identifier',
      }),
      fields: Schema.Record(Schema.String, formattedFieldValueSchema).annotate({
        description: 'User-defined field values (may include display formatting)',
      }),
      createdBy: optionalField(
        Schema.String.annotate({ description: 'User who created the record' })
      ),
      updatedBy: optionalField(
        Schema.String.annotate({ description: 'User who last updated the record' })
      ),
      deletedBy: optionalField(
        Schema.String.annotate({ description: 'User who deleted the record' })
      ),
    }).fields,
    ...timestampSchema.fields,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
).annotate({ title: 'sovrium:open-keys' })

/**
 * Create record response schema
 *
 * Returns record with the canonical shape (id, fields, timestamps at root)
 * AND a flat alias of each user-defined field at the root, e.g. for a record
 * `{ fields: { title: 'Q1 Report', file: 'key' } }` the response also
 * includes `title` and `file` at the root. This lets clients address fields
 * either via `record.fields.<name>` (canonical) or `record.<name>` (flat).
 */
export const createRecordResponseSchema = Schema.StructWithRest(
  Schema.Struct({
    ...Schema.Struct({
      id: Schema.String.annotate({ description: 'Record identifier' }),
      fields: Schema.Record(Schema.String, fieldValueSchema).annotate({
        description: 'User-defined field values',
      }),
      createdBy: optionalField(
        Schema.String.annotate({ description: 'User who created the record' })
      ),
      updatedBy: optionalField(
        Schema.String.annotate({ description: 'User who last updated the record' })
      ),
    }).fields,
    ...timestampSchema.fields,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
).annotate({ title: 'sovrium:open-keys' })

/**
 * Update record response schema
 */
export const updateRecordResponseSchema = Schema.Struct({
  record: describedRef(recordSchema, 'Updated record'),
})

/**
 * Delete record response schema
 */
export const deleteRecordResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Record deleted' }),
})

/**
 * Restore record response schema
 */
export const restoreRecordResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Record restored' }),
  record: describedRef(recordSchema, 'Restored record'),
})

// ============================================================================
// Batch Operation Schemas
// ============================================================================

/**
 * Batch create records response schema
 */
export const batchCreateRecordsResponseSchema = Schema.Struct({
  created: Schema.Finite.annotate({ description: 'Number of records created' }),
  records: optionalField(
    Schema.Array(recordSchema).annotate({
      description: 'Created records (only if returnRecords=true)',
    })
  ),
})

/**
 * Batch update records response schema
 */
export const batchUpdateRecordsResponseSchema = Schema.Struct({
  updated: Schema.Finite.annotate({ description: 'Number of records updated' }),
  records: optionalField(
    Schema.Array(recordSchema).annotate({
      description: 'Updated records (only if returnRecords=true)',
    })
  ),
})

/**
 * Batch delete records response schema
 */
export const batchDeleteRecordsResponseSchema = Schema.Struct({
  deleted: Schema.Finite.annotate({ description: 'Number of records deleted' }),
})

/**
 * Batch restore records response schema
 */
export const batchRestoreRecordsResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'Batch restore succeeded' }),
  restored: Schema.Finite.annotate({ description: 'Number of records restored' }),
})

/**
 * Upsert records response schema
 */
export const upsertRecordsResponseSchema = Schema.Struct({
  records: Schema.Array(recordSchema).annotate({ description: 'Upserted records' }),
  created: Schema.Finite.annotate({ description: 'Number of records created' }),
  updated: Schema.Finite.annotate({ description: 'Number of records updated' }),
})

// ============================================================================
// View Schemas
// ============================================================================

/**
 * View schema
 */
export const viewSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'View identifier' }),
    name: Schema.String.annotate({ description: 'View name' }),
    tableId: Schema.String.annotate({ description: 'Parent table ID' }),
    fields: optionalField(
      Schema.Array(Schema.String).annotate({ description: 'Visible field IDs' })
    ),
    filters: optionalField(Schema.Array(Schema.Unknown).annotate({ description: 'View filters' })),
    sorts: optionalField(Schema.Array(Schema.Unknown).annotate({ description: 'View sorts' })),
    groupBy: optionalField(Schema.String.annotate({ description: 'Group by field' })),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'View' })

/**
 * List views response schema
 */
export const listViewsResponseSchema = Schema.Struct({
  views: Schema.Array(viewSchema).annotate({ description: 'List of views' }),
})

/**
 * Get view response schema
 * Returns view properties directly at root level
 */
export const getViewResponseSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'View identifier' }),
  name: Schema.String.annotate({ description: 'View name' }),
  filters: optionalField(viewFilterNodeResponseSchema),
  sorts: optionalField(
    Schema.Array(
      Schema.Struct({
        field: Schema.String,
        direction: Schema.Literals(['asc', 'desc']),
      })
    ).annotate({ description: 'View sorts' })
  ),
  fields: optionalField(
    Schema.Array(Schema.String).annotate({ description: 'Visible field names' })
  ),
  groupBy: optionalField(
    Schema.Struct({
      field: Schema.String,
      direction: optionalField(Schema.Literals(['asc', 'desc'])),
    }).annotate({ description: 'Group by configuration' })
  ),
  isDefault: optionalField(
    Schema.Boolean.annotate({ description: 'Whether this is the default view' })
  ),
})

/**
 * Get view records response schema
 */
export const getViewRecordsResponseSchema = Schema.Struct({
  records: Schema.Array(recordSchema).annotate({ description: 'Records matching view' }),
  pagination: optionalField(paginationSchema.annotate({ description: 'Pagination metadata' })),
})

// ============================================================================
// Permission Schemas
// ============================================================================

/**
 * Table permission schema
 */
export const tablePermissionSchema = Schema.Struct({
  read: Schema.Boolean.annotate({ description: 'Can read records' }),
  create: Schema.Boolean.annotate({ description: 'Can create records' }),
  update: Schema.Boolean.annotate({ description: 'Can update records' }),
  delete: Schema.Boolean.annotate({ description: 'Can delete records' }),
  manage: Schema.Boolean.annotate({ description: 'Can manage table schema' }),
}).annotate({ identifier: 'TablePermission' })

/**
 * Field permission schema
 */
export const fieldPermissionSchema = Schema.Struct({
  read: Schema.Boolean.annotate({ description: 'Can read field' }),
  write: Schema.Boolean.annotate({ description: 'Can write field' }),
}).annotate({ identifier: 'FieldPermission' })

/**
 * Get table permissions response schema
 */
export const getTablePermissionsResponseSchema = Schema.Struct({
  table: Schema.Struct({
    read: Schema.Boolean.annotate({ description: 'Can read records' }),
    create: Schema.Boolean.annotate({ description: 'Can create records' }),
    update: Schema.Boolean.annotate({ description: 'Can update records' }),
    delete: Schema.Boolean.annotate({ description: 'Can delete records' }),
  }).annotate({ description: 'Table-level permissions' }),
  fields: Schema.Record(Schema.String, fieldPermissionSchema).annotate({
    description: 'Field-level permissions',
  }),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type BaseField = typeof baseFieldSchema.Type
export type FieldValue = typeof fieldValueSchema.Type
export type Table = typeof tableSchema.Type
export type TableSummary = typeof tableSummarySchema.Type
export type Record = typeof recordSchema.Type
/** @public */
export type View = typeof viewSchema.Type
export type TablePermission = typeof tablePermissionSchema.Type
export type ListTablesResponse = typeof listTablesResponseSchema.Type
export type GetTableResponse = typeof getTableResponseSchema.Type
export type ListRecordsResponse = typeof listRecordsResponseSchema.Type
export type GetRecordResponse = typeof getRecordResponseSchema.Type
export type RestoreRecordResponse = typeof restoreRecordResponseSchema.Type
export type BatchRestoreRecordsResponse = typeof batchRestoreRecordsResponseSchema.Type
