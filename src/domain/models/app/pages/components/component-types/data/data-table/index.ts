/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'
import { optBool } from '../../../shared-schemas'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import {
  DataTableColumnSchema,
  DataTableSelectionSchema,
  DataTablePaginationSchema,
  DataTableGroupBySchema,
  DataTableSummaryItemSchema,
  DataTableToolbarSchema,
  DataTableBulkActionSchema,
  RowHeightSchema,
} from './schema'

export const DataTableTypeLiteral = Schema.Literal('data-table')

export const dataTableFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  columns: Schema.optional(
    Schema.Array(DataTableColumnSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Column definitions for data-table component' })
    )
  ),
  selection: Schema.optional(DataTableSelectionSchema),
  pagination: Schema.optional(DataTablePaginationSchema),
  groupBy: Schema.optional(DataTableGroupBySchema),
  summary: Schema.optional(
    Schema.Array(DataTableSummaryItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Summary row with aggregate computations' })
    )
  ),
  toolbar: Schema.optional(DataTableToolbarSchema),
  bulkActions: Schema.optional(
    Schema.Array(DataTableBulkActionSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Actions available when rows are selected' })
    )
  ),
  rowHeight: Schema.optional(RowHeightSchema),
  striped: optBool('Alternating row colors'),
  bordered: optBool('Show cell borders'),
  emptyMessage: Schema.optional(
    Schema.String.annotations({ description: 'Message when no records match' })
  ),
  showRowNumbers: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show row number column' })
  ),
  onRowClick: Schema.optional(ActionSchema),
} as const

// Re-export all sub-schemas for external consumers
export * from './schema'
