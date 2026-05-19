/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const ListItemMetadataSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  format: Schema.optional(
    Schema.String.annotations({
      description: 'Display format (e.g., currency, relative-date, badge, text)',
      examples: ['currency', 'relative-date', 'badge', 'text', 'short-date'],
    })
  ),
}).annotations({
  title: 'List Item Metadata',
  description: 'Metadata field displayed in the list item footer',
})


export const ListItemTemplateSchema = Schema.Struct({
  title: Schema.optional(
    Schema.String.annotations({
      description: 'Primary text using $record.* variable reference',
      examples: ['$record.name', '$record.title'],
    })
  ),
  subtitle: Schema.optional(
    Schema.String.annotations({
      description: 'Secondary text using $record.* variable reference',
      examples: ['$record.description', '$record.excerpt'],
    })
  ),
  image: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL using $record.* variable reference',
      examples: ['$record.thumbnail', '$record.avatar'],
    })
  ),
  badge: Schema.optional(
    Schema.String.annotations({
      description: 'Badge text using $record.* variable reference',
      examples: ['$record.status', '$record.category'],
    })
  ),
  metadata: Schema.optional(
    Schema.Array(ListItemMetadataSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Metadata fields displayed in the list item footer',
      })
    )
  ),
}).annotations({
  identifier: 'ListItemTemplate',
  title: 'List Item Template',
  description: 'Template for rendering each record as a list item with $record.* variables',
})


export const ListDisplaySchema = Schema.Struct({
  itemTemplate: Schema.optional(ListItemTemplateSchema),
  emptyMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Message when no search results match',
      examples: ['No products found', 'No results for your search'],
    })
  ),
  loadMore: Schema.optional(
    Schema.Literal('button', 'infinite').annotations({
      description: "Pagination: 'button' shows a Load More button, 'infinite' loads on scroll",
    })
  ),
  highlight: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Highlight matched search terms in list item text (default: false)',
    })
  ),
  divider: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show visual dividers between list items (default: false)',
    })
  ),
  maxItems: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of items to display',
        examples: [20, 50, 100],
      })
    )
  ),
}).annotations({
  identifier: 'ListDisplay',
  title: 'List Display',
  description:
    'Search-first result display configuration for list components with item templates and pagination',
})


export type ListItemMetadata = Schema.Schema.Type<typeof ListItemMetadataSchema>
export type ListItemTemplate = Schema.Schema.Type<typeof ListItemTemplateSchema>
export type ListDisplay = Schema.Schema.Type<typeof ListDisplaySchema>
