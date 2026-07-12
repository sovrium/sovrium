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

export const dataBoundFields = {
  dataSource: Schema.optional(
    Schema.Union(
      DataSourceSchema,
      Schema.Struct({
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
