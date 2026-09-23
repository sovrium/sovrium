/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { commentSchema, recordHistoryEntrySchema } from '@/domain/models/api/tables/comments'
import { listRecordsQuerySchema } from '@/domain/models/api/tables/params'
import {
  batchCreateRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/tables/records'
import { getRecordResponseSchema, recordSchema } from '@/domain/models/api/tables/tables'
import recordHistoryBody from '@/presentation/api/tables/record-history.docs.md' with { type: 'file' }
import recordsBatchBody from '@/presentation/api/tables/records-batch.docs.md' with { type: 'file' }
import recordsCrudBody from '@/presentation/api/tables/records-crud.docs.md' with { type: 'file' }
import recordsFilteringSortingBody from '@/presentation/api/tables/records-filtering-sorting.docs.md' with { type: 'file' }
import recordsGroupingViewsBody from '@/presentation/api/tables/records-grouping-views.docs.md' with { type: 'file' }
import recordsImportExportBody from '@/presentation/api/tables/records-import-export.docs.md' with { type: 'file' }
import recordsOverviewBody from '@/presentation/api/tables/records-overview.docs.md' with { type: 'file' }
import recordsRealtimeBody from '@/presentation/api/tables/records-realtime.docs.md' with { type: 'file' }
import recordsSoftDeleteBody from '@/presentation/api/tables/records-soft-delete.docs.md' with { type: 'file' }
import recordsUpsertDeleteBody from '@/presentation/api/tables/records-upsert-delete.docs.md' with { type: 'file' }
import runtimeCustomizationBody from '@/presentation/api/tables/runtime-customization.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const records = defineSection({
  slug: 'records',
  title: 'Records API',
  order: 2400,
  tab: 'tables',
  articles: [
    defineArticle({
      slug: 'records-overview',
      title: 'Records Overview',
      description:
        'The REST API every declared table exposes — the URL layout, the fields envelope, the authorship the server stamps, and the rules every records endpoint obeys.',
      keywords: [
        'sovrium',
        'records',
        'REST API',
        'CRUD',
        'fields envelope',
        'createdBy',
        'updatedBy',
        'deletedBy',
        'anti-enumeration',
      ],
      order: 2400,
      sidebarLabel: 'Records Overview',
      body: recordsOverviewBody,
      documents: [recordSchema],
      stories: [
        'US-RECORDS-API-CRUD-OPERATIONS-TIMESTAMPS-ISO',
        'US-RECORDS-API-QUERY-COST',
        'US-TABLES-RATE-LIMITING',
      ],
    }),
    defineArticle({
      slug: 'records-crud',
      title: 'Create, Read and Update',
      description:
        'The single-record lifecycle — the three request shapes, the status each answers with, and the optimistic-locking token that turns a lost update into a 409.',
      keywords: [
        'sovrium',
        'create record',
        'read record',
        'update record',
        'PATCH',
        'optimistic locking',
        '409 Conflict',
        'updatedAt',
      ],
      order: 2410,
      sidebarLabel: 'Create, Read & Update',
      body: recordsCrudBody,
      documents: [getRecordResponseSchema],
      stories: [
        'US-RECORDS-API-CRUD-OPERATIONS-CREATE-RECORD',
        'US-RECORDS-API-CRUD-OPERATIONS-CREATE-WITH-MANY-TO-MANY',
        'US-RECORDS-API-CRUD-OPERATIONS-DEFAULT-OVERRIDABLE',
        'US-RECORDS-API-CRUD-OPERATIONS-GET-SINGLE-RECORD',
        'US-RECORDS-API-CRUD-OPERATIONS-UPDATE-RECORD',
      ],
    }),
    defineArticle({
      slug: 'records-upsert-delete',
      title: 'Upsert and Delete',
      description:
        'Merging records on a unique key, removing them softly or permanently, and the format parameter that decides how values come back on a read.',
      keywords: [
        'sovrium',
        'upsert',
        'fieldsToMergeOn',
        'matchFields',
        'permanent delete',
        'purge',
        'format display',
        'timezone',
      ],
      order: 2414,
      sidebarLabel: 'Upsert & Delete',
      body: recordsUpsertDeleteBody,
      documents: [upsertRecordsRequestSchema],
      stories: [
        'US-RECORDS-API-RECORD-FORMATTING',
        'US-RECORDS-API-UPSERT-MERGE-FIELD-PERMISSION-GATE',
        'US-RECORDS-API-UPSERT-RECORDS',
      ],
    }),
    defineArticle({
      slug: 'records-filtering-sorting',
      title: 'Filtering, Sorting and Pagination',
      description:
        'The list query grammar — every parameter the endpoint reads, the three that behave unlike their neighbours, and the two mistakes that return a wrong answer instead of an error.',
      keywords: [
        'sovrium',
        'filter',
        'sort',
        'pagination',
        'limit',
        'offset',
        'filterByFormula',
        'search',
        'field selection',
      ],
      order: 2420,
      sidebarLabel: 'Filtering, Sorting & Pagination',
      body: recordsFilteringSortingBody,
      documents: [listRecordsQuerySchema],
      stories: [
        'US-RECORDS-API-FILTERING-SORTING-LISTING',
        'US-RECORDS-API-FILTERING-SORTING-SEARCH',
      ],
    }),
    defineArticle({
      slug: 'records-grouping-views',
      title: 'Grouping and Saved Views',
      description:
        'Summarising a list with groupBy and aggregate, reusing a stored filter and sort through a saved view, and reaching rows that have been deleted.',
      keywords: [
        'sovrium',
        'groupBy',
        'aggregate',
        'saved views',
        'aggregations',
        'includeDeleted',
        'trash',
      ],
      order: 2424,
      sidebarLabel: 'Grouping & Saved Views',
      body: recordsGroupingViewsBody,
      documents: [],
      stories: ['US-RECORDS-API-FILTERING-SORTING-VIEWS-GROUPING'],
    }),
    defineArticle({
      slug: 'records-batch',
      title: 'Batch Operations',
      description:
        'Writing many records in one request — the five endpoints, their per-request ceilings, and the all-or-nothing transaction that makes a partial batch impossible.',
      keywords: [
        'sovrium',
        'batch create',
        'batch update',
        'batch delete',
        'batch restore',
        'transaction',
        'returnRecords',
      ],
      order: 2430,
      sidebarLabel: 'Batch Operations',
      body: recordsBatchBody,
      documents: [batchCreateRecordsRequestSchema],
      stories: [
        'US-RECORDS-API-BATCH-OPERATIONS-CREATE-UPDATE',
        'US-RECORDS-API-BATCH-OPERATIONS-DELETE-RESTORE-UPSERT',
        'US-RECORDS-API-BATCH-OPERATIONS-UPSERT-PARITY',
        'US-RECORDS-API-BATCH-OPERATIONS-WRITE-PARITY',
      ],
    }),
    defineArticle({
      slug: 'record-history',
      title: 'Record History and Comments',
      description:
        'The two activity surfaces every record carries — a change history the server maintains on its own, and a comment thread its users write.',
      keywords: [
        'sovrium',
        'record history',
        'audit trail',
        'comments',
        'mentions',
        'change diff',
        'activity',
      ],
      order: 2440,
      sidebarLabel: 'History & Comments',
      body: recordHistoryBody,
      documents: [recordHistoryEntrySchema, commentSchema],
      stories: [
        'US-RECORDS-API-RECORD-HISTORY-COMMENT-PERMISSION-ENFORCEMENT',
        'US-RECORDS-API-RECORD-HISTORY-COMMENT-READ-AND-HISTORY',
        'US-RECORDS-API-RECORD-HISTORY-COMMENT-READ-AND-UNREAD-STATE',
        'US-RECORDS-API-RECORD-HISTORY-COMMENT-WRITE',
      ],
    }),
    defineArticle({
      slug: 'records-soft-delete',
      title: 'Soft Delete and Restore',
      description:
        'Deleting is non-destructive by default — what a soft delete stamps, what a permanent delete costs, how related rows follow, and how to get a row back.',
      keywords: [
        'sovrium',
        'soft delete',
        'restore',
        'trash',
        'permanent delete',
        'onDelete',
        'cascade',
        'deletedAt',
      ],
      order: 2450,
      sidebarLabel: 'Soft Delete & Restore',
      body: recordsSoftDeleteBody,
      documents: [],
      stories: [
        'US-RECORDS-API-SOFT-DELETE-RESTORE-DELETE',
        'US-RECORDS-API-SOFT-DELETE-RESTORE-RESTORE',
      ],
    }),
    defineArticle({
      slug: 'records-realtime',
      title: 'Real-Time Subscriptions',
      description:
        'How a data-bound view stays current without a reload — the three refresh strategies, the endpoints behind them, and the message contract a programmatic client reads.',
      keywords: [
        'sovrium',
        'realtime',
        'refreshMode',
        'pollIntervalMs',
        'WebSocket',
        'SSE',
        'presence',
        'heartbeat',
      ],
      order: 2460,
      sidebarLabel: 'Real-Time Subscriptions',
      body: recordsRealtimeBody,
      documents: [],
      stories: [
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-001',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-002',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-003',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-004',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-005',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-006',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-007',
        'US-RECORDS-API-REAL-TIME-SUBSCRIPTIONS-008',
      ],
    }),
    defineArticle({
      slug: 'records-import-export',
      title: 'Records Import and Export',
      description:
        'Moving bulk data in and out of a table three ways — a CSV wizard in the grid, an export endpoint, and spreadsheet clipboard — all of them ordinary record writes underneath.',
      keywords: [
        'sovrium',
        'CSV import',
        'export',
        'clipboard',
        'recordIds',
        'error report',
        'duplicate handling',
      ],
      order: 2470,
      sidebarLabel: 'Import & Export',
      body: recordsImportExportBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'runtime-customization',
      title: 'Runtime Data Customization',
      description:
        'What end users can change about a view without a developer changing the config, and the boundary that stops personalisation from widening access.',
      keywords: [
        'sovrium',
        'runtime views',
        'saved views',
        'column visibility',
        'toolbar',
        'personalisation',
      ],
      order: 2480,
      sidebarLabel: 'Runtime Customization',
      body: runtimeCustomizationBody,
      documents: [],
      stories: [],
    }),
  ],
})
