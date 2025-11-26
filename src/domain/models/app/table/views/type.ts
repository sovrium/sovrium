/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Type Schema
 *
 * The type of view determines how records are displayed.
 *
 * - `grid`: Tabular data view (spreadsheet-like)
 * - `kanban`: Cards organized in columns
 * - `calendar`: Date-based record display
 * - `gallery`: Card-based layout
 * - `form`: Data entry form view
 * - `list`: Simple list view
 *
 * @example
 * ```typescript
 * 'grid'
 * 'kanban'
 * 'calendar'
 * ```
 */
export const ViewTypeSchema = Schema.Literal(
  'grid',
  'kanban',
  'calendar',
  'gallery',
  'form',
  'list'
).pipe(
  Schema.annotations({
    title: 'View Type',
    description:
      'The display type for the view. Grid shows tabular data, kanban shows cards in columns, calendar shows date-based records, gallery shows card layouts, form is for data entry, and list is a simple list.',
    examples: ['grid', 'kanban', 'calendar'],
  })
)

export type ViewType = Schema.Schema.Type<typeof ViewTypeSchema>
