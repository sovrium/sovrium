/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AutoSaveConfigSchema } from '../../auto-save'
import { ComponentSearchSchema } from '../../component-search'
import { DataSourceSchema } from '../../data-source'
import { SystemSourceSchema } from '../../system-source'

/**
 * Data-bound fields for components connected to database tables.
 * Only for: data-table, kanban, calendar, chart, kpi, gallery, form, list.
 *
 * `dataSource` is discriminated: the shared DB-table binding (`DataSourceSchema`
 * — `{ table, ... }`) OR the shared system read-endpoint binding
 * (`{ system: { endpoint, ... } }`). This generalizes the variant first proven on
 * `data-table` so every rows-oriented data-bound component (data-table + the list
 * family: kanban / calendar / gallery / list / data-timeline) inherits it.
 *
 * Specialized consumers may OVERRIDE this field:
 *  - `chart` / `kpi` replace it with their own series-/scalar-shaped system source;
 *  - `form` (a WRITE surface) overrides it back to the DB-only `DataSourceSchema`,
 *    because a write surface must never read from a system endpoint.
 */
export const dataBoundFields = {
  dataSource: Schema.optional(
    Schema.Union(
      DataSourceSchema,
      Schema.Struct({
        /** System read-endpoint binding (mutually exclusive with the DB-table form) */
        system: SystemSourceSchema,
      }).annotations({
        title: 'Data-Bound System Data Source',
        description: 'System read-endpoint binding for a data-bound component',
      })
    ).annotations({
      identifier: 'DataBoundComponentDataSource',
      title: 'Data-Bound Data Source',
      description: 'DB-table binding (DataSource) OR a system read-endpoint binding',
    })
  ),
  autoSave: Schema.optional(AutoSaveConfigSchema),
  search: Schema.optional(ComponentSearchSchema),
} as const
