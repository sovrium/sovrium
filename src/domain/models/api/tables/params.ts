/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const tableIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
})

export const recordIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  recordId: z.string().describe('Record identifier'),
})

export const commentIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  recordId: z.string().describe('Record identifier'),
  commentId: z.string().describe('Comment identifier'),
})

export const viewIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  viewId: z.string().describe('View identifier'),
})


export const recordOnlyParamSchema = z.object({
  recordId: z.string().describe('Record identifier'),
})

export const commentOnlyParamSchema = z.object({
  recordId: z.string().describe('Record identifier'),
  commentId: z.string().describe('Comment identifier'),
})

export const viewOnlyParamSchema = z.object({
  viewId: z.string().describe('View identifier'),
})


export const listRecordsQuerySchema = z.object({
  page: z.string().optional().describe('Page number (1-indexed)'),
  limit: z.string().optional().describe('Items per page'),
  sort: z.string().optional().describe('Sort expression (e.g. "field:asc,field2:desc")'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  q: z.string().optional().describe('Search query'),
  fields: z.string().optional().describe('Comma-separated field names to include'),
  format: z.enum(['raw', 'display']).optional().describe('Field value format'),
  timezone: z.string().optional().describe('IANA timezone for date formatting'),
  includeDeleted: z.string().optional().describe('Set to "true" to include soft-deleted records'),
  deleted: z
    .string()
    .optional()
    .describe('Set to "true" to list only soft-deleted records (trash view)'),
  filter: z.string().optional().describe('Filter expression'),
  aggregate: z.string().optional().describe('JSON aggregate parameters'),
  groupBy: z.string().optional().describe('Field name to group records by'),
})


export const commentBodySchema = z.object({
  content: z.string().min(1).max(10_000).describe('Comment text'),
})
