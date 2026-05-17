/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'

// ---------------------------------------------------------------------------
// KanbanGroupBySchema
// ---------------------------------------------------------------------------

/**
 * Kanban group-by configuration
 *
 * Defines how records are grouped into columns. The `field` must reference
 * a select/status field whose distinct values become column headers.
 *
 * @example
 * ```yaml
 * groupBy:
 *   field: status
 * ```
 */
export const KanbanGroupBySchema = Schema.Struct({
  /** Field name to group records by (select/status field) */
  field: Schema.String.annotations({
    description:
      'Field name whose distinct values create kanban columns (typically a select/status field)',
  }),
}).annotations({
  identifier: 'KanbanGroupBy',
  title: 'Kanban Group By',
  description: 'Configuration for how records are grouped into kanban columns',
})

// ---------------------------------------------------------------------------
// KanbanCardFooterItemSchema
// ---------------------------------------------------------------------------

/**
 * A single metadata field shown in the card footer
 */
export const KanbanCardFooterItemSchema = Schema.Struct({
  /** Field name to display */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Display format for the value */
  format: Schema.optional(
    Schema.Literal('relative-date', 'short-date', 'avatar', 'badge', 'text').annotations({
      description: 'How to format the field value in the footer',
    })
  ),
}).annotations({
  title: 'Kanban Card Footer Item',
  description: 'Metadata field displayed in the kanban card footer',
})

// ---------------------------------------------------------------------------
// KanbanCardSchema
// ---------------------------------------------------------------------------

/**
 * Kanban card template configuration
 *
 * Defines how each record renders as a card on the board.
 * Supports child components with `$record.*` variable substitution,
 * cover images, click actions, footer metadata, and color coding.
 *
 * @example
 * ```yaml
 * card:
 *   children:
 *     - type: heading
 *       props: { className: 'text-sm font-medium' }
 *       content: '$record.title'
 *   onClick:
 *     type: navigate
 *     path: /tasks/$record.id
 *   coverImage: '$record.thumbnail'
 *   colorField: priority
 * ```
 */
export const KanbanCardSchema = Schema.Struct({
  /** Child components for the card body (supports $record.* variables) */
  children: Schema.optional(
    Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Child component definitions for the card body',
      })
    )
  ),
  /** Action triggered when the card is clicked */
  onClick: Schema.optional(ActionSchema),
  /** Field reference or $record.* variable for the cover image URL */
  coverImage: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL or $record.* variable for card cover image',
      examples: ['$record.thumbnail', '$record.coverImage'],
    })
  ),
  /** Field name whose values map to card background colors */
  colorField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name whose values determine card background color',
      examples: ['priority', 'category'],
    })
  ),
  /** Metadata fields displayed in the card footer */
  footer: Schema.optional(
    Schema.Array(KanbanCardFooterItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Metadata fields displayed in the card footer area',
      })
    )
  ),
}).annotations({
  identifier: 'KanbanCard',
  title: 'Kanban Card',
  description: 'Template configuration for how records render as kanban cards',
})

// ---------------------------------------------------------------------------
// KanbanDragSchema
// ---------------------------------------------------------------------------

/**
 * Kanban drag-and-drop configuration
 *
 * Controls whether cards can be dragged between columns and how
 * changes are persisted to the database.
 *
 * @example
 * ```yaml
 * drag:
 *   enabled: true
 *   persistAction:
 *     type: crud
 *     operation: update
 *     table: tasks
 * ```
 */
export const KanbanDragSchema = Schema.Struct({
  /** Whether drag-and-drop is enabled */
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable drag-and-drop between columns (default: true)',
    })
  ),
  /** Action to persist field value change after drop */
  persistAction: Schema.optional(ActionSchema),
}).annotations({
  identifier: 'KanbanDrag',
  title: 'Kanban Drag',
  description: 'Drag-and-drop configuration for kanban cards',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type KanbanGroupBy = Schema.Schema.Type<typeof KanbanGroupBySchema>
export type KanbanCardFooterItem = Schema.Schema.Type<typeof KanbanCardFooterItemSchema>
export type KanbanCard = Schema.Schema.Type<typeof KanbanCardSchema>
export type KanbanDrag = Schema.Schema.Type<typeof KanbanDragSchema>
