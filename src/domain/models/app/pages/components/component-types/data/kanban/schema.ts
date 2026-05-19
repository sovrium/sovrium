/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'


export const KanbanGroupBySchema = Schema.Struct({
  field: Schema.String.annotations({
    description:
      'Field name whose distinct values create kanban columns (typically a select/status field)',
  }),
}).annotations({
  identifier: 'KanbanGroupBy',
  title: 'Kanban Group By',
  description: 'Configuration for how records are grouped into kanban columns',
})


export const KanbanCardFooterItemSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  format: Schema.optional(
    Schema.Literal('relative-date', 'short-date', 'avatar', 'badge', 'text').annotations({
      description: 'How to format the field value in the footer',
    })
  ),
}).annotations({
  title: 'Kanban Card Footer Item',
  description: 'Metadata field displayed in the kanban card footer',
})


export const KanbanCardSchema = Schema.Struct({
  children: Schema.optional(
    Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Child component definitions for the card body',
      })
    )
  ),
  onClick: Schema.optional(ActionSchema),
  coverImage: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL or $record.* variable for card cover image',
      examples: ['$record.thumbnail', '$record.coverImage'],
    })
  ),
  colorField: Schema.optional(
    Schema.String.annotations({
      description: 'Field name whose values determine card background color',
      examples: ['priority', 'category'],
    })
  ),
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


export const KanbanDragSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable drag-and-drop between columns (default: true)',
    })
  ),
  persistAction: Schema.optional(ActionSchema),
}).annotations({
  identifier: 'KanbanDrag',
  title: 'Kanban Drag',
  description: 'Drag-and-drop configuration for kanban cards',
})


export type KanbanGroupBy = Schema.Schema.Type<typeof KanbanGroupBySchema>
export type KanbanCardFooterItem = Schema.Schema.Type<typeof KanbanCardFooterItemSchema>
export type KanbanCard = Schema.Schema.Type<typeof KanbanCardSchema>
export type KanbanDrag = Schema.Schema.Type<typeof KanbanDragSchema>
