/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SystemSourceRefSchema } from '../../../../../systemSources'
import { ActionSchema } from '../../../action'
import { DataSourceSchema } from '../../../data-source'
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
  DataTableSystemSourceSchema,
  RowHeightSchema,
} from './schema'

export const DataTableTypeLiteral = Schema.Literal('data-table')

export const dataTableFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  dataSource: Schema.optional(
    Schema.Union(
      DataSourceSchema,
      Schema.Struct({
        system: DataTableSystemSourceSchema,
      }).annotations({
        title: 'Data Table System Data Source',
        description: 'System read-endpoint binding for the data table',
      }),
      SystemSourceRefSchema
    ).annotations({
      identifier: 'DataTableComponentDataSource',
      title: 'Data Table Data Source',
      description:
        'DB-table binding (DataSource), an inline system read-endpoint binding, OR a named app.systemSources reference',
    })
  ),
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
  noMatchMessage: Schema.optional(
    Schema.String.annotations({
      description:
        'Message shown when a search/filter reduces a non-empty dataset to zero rows (the no-match state, distinct from emptyMessage). Rendered in an aria-live status region; a {query} token is replaced with the active search string so the message echoes the query. Falls back to emptyMessage when omitted.',
      examples: ['No results for "{query}"', 'Aucun utilisateur ne correspond à « {query} »'],
    })
  ),
  showRowNumbers: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show row number column' })
  ),
  onRowClick: Schema.optional(ActionSchema),
} as const

export * from './schema'
