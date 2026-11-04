/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, DataSortSchema } from '../components/data-source'

// ============================================================================
// Structured Data — ItemList built from a table's rows
// ============================================================================

/**
 * The rows an `itemList` describes: a table, and optionally the filter and
 * sort a list component's `dataSource` takes. The same three keys, so the
 * JSON-LD and the visible list on the page can read exactly the same rows.
 *
 * The rows are read for the person requesting the page, with the table's,
 * the row-level and the field-level read rules applied, exactly as a bound
 * list reads them: a crawler is a signed-out reader, so a row it may not read
 * never reaches the page's JSON-LD.
 */
export const ItemListDataSourceSchema = Schema.Struct({
  table: Schema.String.annotate({
    description: 'Table whose rows the list describes, by its declared name',
    examples: ['apps'],
  }),
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description:
        'Filter conditions applied with AND logic, in the grammar of a list component dataSource filter',
    })
  ),
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotate({
      description:
        'Sort rules applied in order; the first row is position 1. Without a sort the rows come in the order the table reads them',
    })
  ),
}).annotate({
  title: 'ItemList Data Source',
  description: 'The table, filter and sort whose rows become the list items',
})

/**
 * How one row becomes one `ListItem`. Both values are templates over the row:
 * `$record.<field>` is replaced by that field's value.
 */
export const ItemListItemSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'Name of each item, templated on the row (for example $record.name)',
    examples: ['$record.name'],
  }),
  url: Schema.String.annotate({
    description:
      "Address of each item, templated on the row (for example /apps/$record.slug); emitted as a full address on the request host, with the page's language prefix",
    examples: ['/apps/$record.slug'],
  }),
}).annotate({
  title: 'ItemList Item',
  description: 'How one row becomes one ListItem: its name and its address',
})

/**
 * `meta.schema.itemList`: a Schema.org `ItemList` built from a table's rows
 * when the page is requested, one `ListItem` (`position`, `name`, `url`) per
 * row the reader may read.
 */
export const ItemListSourceSchema = Schema.Struct({
  dataSource: ItemListDataSourceSchema,
  item: ItemListItemSchema,
}).annotate({
  title: 'ItemList From Rows',
  description:
    "Describe the rows a list page shows as a Schema.org ItemList, read under the requesting reader's permissions",
})

/** An authored `meta.schema` object carrying the `itemList` key. */
export type ItemListCarrier = { readonly itemList: unknown }

/** True when an authored `meta.schema` value is an object carrying `itemList`. */
export const isItemListCarrier = (value: unknown): value is ItemListCarrier =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'itemList' in value

/** True when a value is a well-formed `itemList` source. */
export const isItemListSource = Schema.is(ItemListSourceSchema)

/** @public */
export type ItemListDataSource = Schema.Schema.Type<typeof ItemListDataSourceSchema>
/** @public */
export type ItemListItem = Schema.Schema.Type<typeof ItemListItemSchema>
/** @public */
export type ItemListSource = Schema.Schema.Type<typeof ItemListSourceSchema>
