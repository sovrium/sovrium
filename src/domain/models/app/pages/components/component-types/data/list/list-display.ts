/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// ListItemMetadataSchema
// ---------------------------------------------------------------------------

/**
 * A single metadata field displayed in the list item footer area.
 *
 * @example
 * ```yaml
 * metadata:
 *   - field: price
 *     format: currency
 *   - field: updatedAt
 *     format: relative-date
 * ```
 */
export const ListItemMetadataSchema = Schema.Struct({
  /** Field name from the data source table */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Display format for the value */
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

// ---------------------------------------------------------------------------
// ListItemTemplateSchema
// ---------------------------------------------------------------------------

/**
 * Template for how each record renders as a list item.
 *
 * Uses `$record.*` variable references to map fields to display positions.
 *
 * @example
 * ```yaml
 * itemTemplate:
 *   title: '$record.name'
 *   subtitle: '$record.description'
 *   image: '$record.thumbnail'
 *   badge: '$record.category'
 *   metadata:
 *     - field: price
 *       format: currency
 * ```
 */
export const ListItemTemplateSchema = Schema.Struct({
  /** Primary text (e.g., '$record.name') */
  title: Schema.optional(
    Schema.String.annotations({
      description: 'Primary text using $record.* variable reference',
      examples: ['$record.name', '$record.title'],
    })
  ),
  /** Secondary text (e.g., '$record.description') */
  subtitle: Schema.optional(
    Schema.String.annotations({
      description: 'Secondary text using $record.* variable reference',
      examples: ['$record.description', '$record.excerpt'],
    })
  ),
  /** Image URL (e.g., '$record.thumbnail') */
  image: Schema.optional(
    Schema.String.annotations({
      description: 'Image URL using $record.* variable reference',
      examples: ['$record.thumbnail', '$record.avatar'],
    })
  ),
  /** Badge text (e.g., '$record.status') */
  badge: Schema.optional(
    Schema.String.annotations({
      description: 'Badge text using $record.* variable reference',
      examples: ['$record.status', '$record.category'],
    })
  ),
  /** Additional metadata fields in the item footer */
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

// ---------------------------------------------------------------------------
// ListDisplaySchema
// ---------------------------------------------------------------------------

/**
 * List display configuration for search-first result display.
 *
 * The list component is designed as a search-first display — the natural
 * companion for `searchInput`. A searchInput component drives the query
 * (via `dataSource.bindTo`), and the list displays results with custom
 * templates, highlighting, and pagination.
 *
 * @example
 * ```yaml
 * listDisplay:
 *   itemTemplate:
 *     title: '$record.name'
 *     subtitle: '$record.description'
 *     image: '$record.thumbnail'
 *     badge: '$record.category'
 *     metadata:
 *       - field: price
 *         format: currency
 *   emptyMessage: No products found
 *   loadMore: infinite
 *   highlight: true
 *   divider: true
 *   maxItems: 50
 * ```
 */
export const ListDisplaySchema = Schema.Struct({
  /** Template for rendering each list item */
  itemTemplate: Schema.optional(ListItemTemplateSchema),
  /** Message shown when no results match */
  emptyMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Message when no search results match',
      examples: ['No products found', 'No results for your search'],
    })
  ),
  /** Pagination mode for loading more results */
  loadMore: Schema.optional(
    Schema.Literal('button', 'infinite').annotations({
      description: "Pagination: 'button' shows a Load More button, 'infinite' loads on scroll",
    })
  ),
  /** Highlight matched search terms in results */
  highlight: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Highlight matched search terms in list item text (default: false)',
    })
  ),
  /** Show dividers between list items */
  divider: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show visual dividers between list items (default: false)',
    })
  ),
  /** Maximum number of items to display */
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

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ListItemMetadata = Schema.Schema.Type<typeof ListItemMetadataSchema>
export type ListItemTemplate = Schema.Schema.Type<typeof ListItemTemplateSchema>
export type ListDisplay = Schema.Schema.Type<typeof ListDisplaySchema>
