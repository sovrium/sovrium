/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optBool } from '../../../shared-schemas'

export const DataTableToolbarSchema = Schema.Struct({
  search: optBool('Show search input'),
  filters: optBool('Show filter builder'),
  sort: optBool('Show sort builder'),
  export: optBool('Show export button'),
  refresh: optBool('Show refresh button'),
  density: optBool('Show row density toggle'),
  columnToggle: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show column visibility toggle' })
  ),
}).annotations({
  title: 'Data Table Toolbar',
  description: 'Toolbar control visibility configuration',
})

export type DataTableToolbar = Schema.Schema.Type<typeof DataTableToolbarSchema>
