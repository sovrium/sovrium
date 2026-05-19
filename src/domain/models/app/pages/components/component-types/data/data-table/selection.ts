/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const DataTableSelectionSchema = Schema.Struct({
  mode: Schema.Literal('none', 'single', 'multiple').annotations({
    description: 'Row selection mode (default: none)',
  }),
  showCheckboxes: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show checkbox column (default: true when mode is multiple)',
    })
  ),
}).annotations({
  title: 'Data Table Selection',
  description: 'Row selection configuration',
})

export type DataTableSelection = Schema.Schema.Type<typeof DataTableSelectionSchema>
