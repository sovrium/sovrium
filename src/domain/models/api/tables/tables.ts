/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { paginationSchema, timestampSchema } from '../_shared/common'


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

export const formattedFieldValueSchema = z
  .union([
    fieldValueSchema,
    z.object({
      value: fieldValueSchema,
      displayValue: z.string().optional(),
    }),
  ])
  .openapi('FormattedFieldValue')


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


export const recordSchema = z
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
  .openapi('Record')


export const listTablesResponseSchema = z.object({
  tables: z.array(tableSummarySchema).describe('List of tables'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
})

export const getTableResponseSchema = z.object({
  table: tableSchema.describe('Table details'),
})

export const createTableResponseSchema = z.object({
  table: tableSchema.describe('Created table'),
})

export const updateTableResponseSchema = z.object({
  table: tableSchema.describe('Updated table'),
})

export const deleteTableResponseSchema = z.object({
  success: z.literal(true).describe('Table deleted'),
})


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

export const listRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('List of records'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
  aggregations: aggregationsSchema.optional(),
  groups: z
    .array(
      z.object({
        name: z.union([z.string(), z.null()]).describe('Group value from the groupBy field'),
        count: z.number().describe('Number of records in group'),
        aggregations: aggregationsSchema.optional(),
      })
    )
    .optional()
    .describe('Grouped aggregation results when groupBy is provided'),
})

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
  .passthrough()

export const createRecordResponseSchema = z
  .object({
    id: z.string().describe('Record identifier'),
    fields: z.record(z.string(), fieldValueSchema).describe('User-defined field values'),
    createdBy: z.string().optional().describe('User who created the record'),
    updatedBy: z.string().optional().describe('User who last updated the record'),
  })
  .extend(timestampSchema.shape)
  .passthrough()

export const updateRecordResponseSchema = z.object({
  record: recordSchema.describe('Updated record'),
})

export const deleteRecordResponseSchema = z.object({
  success: z.literal(true).describe('Record deleted'),
})

export const restoreRecordResponseSchema = z.object({
  success: z.literal(true).describe('Record restored'),
  record: recordSchema.describe('Restored record'),
})


export const batchCreateRecordsResponseSchema = z.object({
  created: z.number().describe('Number of records created'),
  records: z
    .array(recordSchema)
    .optional()
    .describe('Created records (only if returnRecords=true)'),
})

export const batchUpdateRecordsResponseSchema = z.object({
  updated: z.number().describe('Number of records updated'),
  records: z
    .array(recordSchema)
    .optional()
    .describe('Updated records (only if returnRecords=true)'),
})

export const batchDeleteRecordsResponseSchema = z.object({
  deleted: z.number().describe('Number of records deleted'),
})

export const batchRestoreRecordsResponseSchema = z.object({
  success: z.literal(true).describe('Batch restore succeeded'),
  restored: z.number().describe('Number of records restored'),
})

export const upsertRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('Upserted records'),
  created: z.number().describe('Number of records created'),
  updated: z.number().describe('Number of records updated'),
})


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

export const listViewsResponseSchema = z.object({
  views: z.array(viewSchema).describe('List of views'),
})

export const getViewResponseSchema = z.object({
  id: z.string().describe('View identifier'),
  name: z.string().describe('View name'),
  filters: z
    .object({
      and: z
        .array(
          z.object({
            field: z.string(),
            operator: z.string(),
            value: z.unknown(),
          })
        )
        .optional(),
      or: z
        .array(
          z.object({
            field: z.string(),
            operator: z.string(),
            value: z.unknown(),
          })
        )
        .optional(),
    })
    .optional()
    .describe('View filters'),
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

export const getViewRecordsResponseSchema = z.object({
  records: z.array(recordSchema).describe('Records matching view'),
  pagination: paginationSchema.optional().describe('Pagination metadata'),
})


export const tablePermissionSchema = z
  .object({
    read: z.boolean().describe('Can read records'),
    create: z.boolean().describe('Can create records'),
    update: z.boolean().describe('Can update records'),
    delete: z.boolean().describe('Can delete records'),
    manage: z.boolean().describe('Can manage table schema'),
  })
  .openapi('TablePermission')

export const fieldPermissionSchema = z
  .object({
    read: z.boolean().describe('Can read field'),
    write: z.boolean().describe('Can write field'),
  })
  .openapi('FieldPermission')

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
