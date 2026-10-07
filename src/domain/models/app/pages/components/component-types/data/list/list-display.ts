/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CurrencyCodeSchema } from '@/domain/models/app/tables/fields/field-types/currency-display'

// ---------------------------------------------------------------------------
// ListItemMetadataSchema
// ---------------------------------------------------------------------------

/**
 * Per-entry format options. Mirrors a KPI's `kpiFormat.options.currency`: a
 * list has no other place to say which currency a bare number is in.
 *
 * A column declared as a `currency` field already carries its own code, and its
 * code wins — the option exists for the number, decimal and computed columns
 * that carry none, which otherwise print in US dollars.
 */
const ListItemMetadataOptionsSchema = Schema.Struct({
  currency: Schema.optional(
    CurrencyCodeSchema.annotate({
      description:
        'ISO 4217 code a `format: currency` entry prints in, when its field is a plain number that declares no currency of its own. A `currency` field keeps the code it declares.',
      defaultNote: 'the field currency, else USD',
      examples: ['EUR', 'GBP', 'CHF'],
    })
  ),
}).annotate({
  title: 'List Item Metadata Options',
  description: 'Format options for one metadata entry',
})

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
 *   # a plain number column, printed in euros
 *   - field: budget
 *     format: currency
 *     options: { currency: EUR }
 * ```
 */
export const ListItemMetadataSchema = Schema.Struct({
  /** Field name from the data source table */
  field: Schema.String.annotate({
    description: 'Field name from the data source table',
  }),
  /** Display format for the value */
  format: Schema.optional(
    Schema.String.annotate({
      description: 'Display format (e.g., currency, relative-date, badge, text)',
      examples: ['currency', 'relative-date', 'badge', 'text', 'short-date'],
    })
  ),
  /** Format options, e.g. the currency a plain number prints in */
  options: Schema.optional(ListItemMetadataOptionsSchema),
  /**
   * Classes on THIS entry only. The `meta` part styles every entry of every
   * row alike; a row whose first detail must read differently (the overdue
   * date in the error ink, the rest muted) was reached with a positional
   * selector (`[&_li>div:last-child>span:first-child]`). The entry is the
   * author's own config, so it carries its own classes, the way a `text`
   * component does.
   */
  className: Schema.optional(
    Schema.String.annotate({
      description:
        "Tailwind classes on this metadata entry in every row, layered over the list's `meta` part — the one detail that must read differently from the others",
      examples: ['font-medium text-error'],
    })
  ),
}).annotate({
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
    Schema.String.annotate({
      description: 'Primary text using $record.* variable reference',
      examples: ['$record.name', '$record.title'],
    })
  ),
  /** Secondary text (e.g., '$record.description') */
  subtitle: Schema.optional(
    Schema.String.annotate({
      description: 'Secondary text using $record.* variable reference',
      examples: ['$record.description', '$record.excerpt'],
    })
  ),
  /** Image URL (e.g., '$record.thumbnail') */
  image: Schema.optional(
    Schema.String.annotate({
      description: 'Image URL using $record.* variable reference',
      examples: ['$record.thumbnail', '$record.avatar'],
    })
  ),
  /** Badge text (e.g., '$record.status') */
  badge: Schema.optional(
    Schema.String.annotate({
      description: 'Badge text using $record.* variable reference',
      examples: ['$record.status', '$record.category'],
    })
  ),
  /** Additional metadata fields in the item footer */
  metadata: Schema.optional(
    Schema.Array(ListItemMetadataSchema).pipe(
      Schema.annotate({
        description: 'Metadata fields displayed in the list item footer',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
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
 * companion for `search-input`. A search-input component drives the query
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
 *   hideWhenEmpty: false
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
    Schema.String.annotate({
      description: 'Message when no search results match',
      examples: ['No products found', 'No results for your search'],
    })
  ),
  /**
   * Draw nothing at all when the binding returns no record.
   *
   * A notice that should appear only when a record matches — "your account is
   * not linked to your accounting tool yet" — is a list filtered on that
   * condition. Without this key an empty list still drew its empty state: the
   * `emptyMessage`, or an empty bordered box when the message was `''`. So
   * there was no way to say "show this only if there are rows". With it, an
   * empty list leaves no message, no box and no visible host, whether the
   * server draws the list or the browser fetches its rows; a list with rows
   * draws them as usual. `emptyMessage` is not shown when this is on.
   */
  hideWhenEmpty: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'If true, a list whose binding returns no record draws nothing: no empty message, no empty box, no visible container. A list with records draws them as usual (default: false, which shows the empty state).',
    })
  ),
  /** Pagination mode for loading more results */
  loadMore: Schema.optional(
    Schema.Literals(['button', 'infinite']).annotate({
      description: "Pagination: 'button' shows a Load More button, 'infinite' loads on scroll",
    })
  ),
  /** Highlight matched search terms in results */
  highlight: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Highlight matched search terms in list item text (default: false)',
    })
  ),
  /** Show dividers between list items */
  divider: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Show visual dividers between list items (default: false)',
    })
  ),
  /** Maximum number of items to display */
  maxItems: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Maximum number of items to display',
        examples: [20, 50, 100],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /**
   * How one row lays out its title and its trailing details.
   *
   * `inline` (the default) keeps the row on one line: the title truncates to
   * leave room for the badge and the metadata on the right. `stacked` gives the
   * title the row's full width — wrapped, never cut — and lays the badge and
   * the metadata on the line below. A narrow column (a dashboard side panel, a
   * phone) reads a stacked list; the templates were getting there with five
   * descendant selectors on every such list.
   */
  itemLayout: Schema.optional(
    Schema.Literals(['inline', 'stacked']).annotate({
      description:
        "How each row lays out: 'inline' (default) keeps title, badge and metadata on one line and truncates the title; 'stacked' gives the title the full width, wrapped, with the badge and metadata on the line below.",
    })
  ),
}).annotate({
  identifier: 'ListDisplay',
  title: 'List Display',
  description:
    'Search-first result display configuration for list components with item templates and pagination',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public Public type surface of the list schema; awaiting adoption at callsites. */
export type ListItemMetadata = Schema.Schema.Type<typeof ListItemMetadataSchema>
/** @public Public type surface of the list schema; awaiting adoption at callsites. */
export type ListItemTemplate = Schema.Schema.Type<typeof ListItemTemplateSchema>
/** @public Public type surface of the list schema; awaiting adoption at callsites. */
export type ListDisplay = Schema.Schema.Type<typeof ListDisplaySchema>
