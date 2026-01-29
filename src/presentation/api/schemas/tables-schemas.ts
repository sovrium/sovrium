/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { paginationSchema, timestampSchema } from './common-schemas'

// ============================================================================
// Field Schemas
// ============================================================================

/**
 * Base field schema
 *
 * Common properties for all field types.
 */
export const baseFieldSchema = z.object({
  id: z.string().describe('Field identifier'),
  name: z.string().describe('Field name'),
  type: z.string().describe('Field type'),
  required: z.boolean().optional().describe('Whether field is required'),
  unique: z.boolean().optional().describe('Whether field must be unique'),
  indexed: z.boolean().optional().describe('Whether field is indexed'),
  description: z.string().optional().describe('Field description'),
})

/**
 * Field value schema (for record data)
 *
 * Represents a value in a record field.
 */
export const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
])

/**
 * Formatted field value schema (for display formatting)
 *
 * When format=display is requested, fields may include both value and displayValue.
 */
export const formattedFieldValueSchema = z.union([
  fieldValueSchema,
  z.object({
    value: fieldValueSchema,
    displayValue: z.string().optional(),
  }),
])

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
  })
  .extend(timestampSchema.shape)

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

// ============================================================================
// Record Schemas
// ============================================================================

/**
 * Record schema (Airtable-style)
 *
 * Represents a record in a table.
 * User-defined fields are nested under the `fields` property.
 * System fields (id, createdAt, updatedAt) remain at root level.
 */
export const recordSchema = z
  .object({
    id: z.string().describe('Record identifier'),
    fields: z
      .record(z.string(), formattedFieldValueSchema)
      .describe('User-defined field values (may include display formatting)'),
    createdBy: z.string().optional().describe('User who created the record'),
    updatedBy: z.string().optional().describe('User who last updated the record'),
  })
  .extend(timestampSchema.shape)

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

/**
 * Create table response schema
 */
export const createTableResponseSchema = z.object({
  table: tableSchema.describe('Created table'),
})

/**
 * Update table response schema
 */
export const updateTableResponseSchema = z.object({
  table: tableSchema.describe('Updated table'),
})

/**
 * Delete table response schema
 */
export const deleteTableResponseSchema = z.object({
  success: z.literal(true).describe('Table deleted'),
})

// ============================================================================
// Record API Response Schemas
// ============================================================================

/**
 * List records response schema
 */
export const listRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('List of records'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
})

/**
 * Get record response schema
 *
 * Returns record in flattened format (id, fields, timestamps at root level)
 * to match test expectations and provide consistent API response structure.
 */
export const getRecordResponseSchema = z
  .object({
    id: z.union([z.string(), z.number()]).describe('Record identifier'),
    fields: z
      .record(z.string(), formattedFieldValueSchema)
      .describe('User-defined field values (may include display formatting)'),
  })
  .extend(timestampSchema.shape)

/**
 * Create record response schema
 *
 * Returns record in flattened format (id, fields, timestamps at root level)
 * to match test expectations and provide consistent API response structure.
 */
export const createRecordResponseSchema = z
  .object({
    id: z.string().describe('Record identifier'),
    owner_id: z.string().optional().describe('Record owner ID (auto-set from session)'),
    organization_id: z.string().optional().describe('Organization ID (auto-set from session)'),
    fields: z.record(z.string(), fieldValueSchema).describe('User-defined field values'),
  })
  .extend(timestampSchema.shape)

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
  records: z.array(recordSchema).describe('Created records'),
  count: z.number().describe('Number of records created'),
})

/**
 * Batch update records response schema
 */
export const batchUpdateRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('Updated records'),
  count: z.number().describe('Number of records updated'),
})

/**
 * Batch delete records response schema
 */
export const batchDeleteRecordsResponseSchema = z.object({
  success: z.literal(true).describe('Batch delete succeeded'),
  count: z.number().describe('Number of records deleted'),
  deletedIds: z.array(z.string()).describe('IDs of deleted records'),
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

/**
 * List views response schema
 */
export const listViewsResponseSchema = z.object({
  views: z.array(viewSchema).describe('List of views'),
})

/**
 * Get view response schema
 */
export const getViewResponseSchema = z.object({
  view: viewSchema.describe('View details'),
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
export const tablePermissionSchema = z.object({
  read: z.boolean().describe('Can read records'),
  create: z.boolean().describe('Can create records'),
  update: z.boolean().describe('Can update records'),
  delete: z.boolean().describe('Can delete records'),
  manage: z.boolean().describe('Can manage table schema'),
})

/**
 * Field permission schema
 */
export const fieldPermissionSchema = z.object({
  read: z.boolean().describe('Can read field'),
  write: z.boolean().describe('Can write field'),
})

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
export type View = z.infer<typeof viewSchema>
export type TablePermission = z.infer<typeof tablePermissionSchema>
export type ListTablesResponse = z.infer<typeof listTablesResponseSchema>
export type GetTableResponse = z.infer<typeof getTableResponseSchema>
export type ListRecordsResponse = z.infer<typeof listRecordsResponseSchema>
export type GetRecordResponse = z.infer<typeof getRecordResponseSchema>
export type RestoreRecordResponse = z.infer<typeof restoreRecordResponseSchema>
export type BatchRestoreRecordsResponse = z.infer<typeof batchRestoreRecordsResponseSchema>
