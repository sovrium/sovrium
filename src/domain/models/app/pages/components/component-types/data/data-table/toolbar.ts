/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optBool } from '../../../shared-schemas'

/**
 * Toolbar control visibility flags.
 *
 * @example
 * ```yaml
 * toolbar:
 *   search: true
 *   filters: true
 *   export: true
 * ```
 */
export const DataTableToolbarSchema = Schema.Struct({
  /** Show global search input */
  search: optBool('Show search input'),
  /** Show filter builder UI */
  filters: optBool('Show filter builder'),
  /** Show sort builder UI */
  sort: optBool('Show sort builder'),
  /** Show CSV/JSON export button */
  export: optBool('Show export button'),
  /** Show manual refresh button */
  refresh: optBool('Show refresh button'),
  /** Show row density toggle */
  density: optBool('Show row density toggle'),
  /** Show column visibility toggle */
  columnToggle: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show column visibility toggle' })
  ),
}).annotations({
  title: 'Data Table Toolbar',
  description: 'Toolbar control visibility configuration',
})

export type DataTableToolbar = Schema.Schema.Type<typeof DataTableToolbarSchema>
