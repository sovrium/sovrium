/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Row selection configuration.
 *
 * @example
 * ```yaml
 * selection:
 *   mode: multiple
 *   showCheckboxes: true
 * ```
 */
export const DataTableSelectionSchema = Schema.Struct({
  /** Selection mode */
  mode: Schema.Literals(['none', 'single', 'multiple']).annotate({
    description: 'Row selection mode (default: none)',
  }),
  /** Show checkbox column (default: true when mode is multiple) */
  showCheckboxes: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Show checkbox column (default: true when mode is multiple)',
    })
  ),
}).annotate({
  title: 'Data Table Selection',
  description: 'Row selection configuration',
})

export type DataTableSelection = Schema.Schema.Type<typeof DataTableSelectionSchema>
