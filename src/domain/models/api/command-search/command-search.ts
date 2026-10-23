/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * `GET /api/command-search?q=` — what the ⌘K palette of an app finds for the
 * words typed: the pages the reader may open, and the records she may read.
 *
 * A record result names its table twice: `tableName`, the address the palette
 * groups and opens by, and `tableLabel`, the table's plural label in the app's
 * default language, so the one "Records" group can say which table each match comes
 * from without printing a machine name. `label` is the matched row's display
 * value, read under the same table, column and row rules as the records API:
 * a row she may not read is absent, and a column she may not read is neither
 * searched nor shown.
 */
export const commandSearchResultSchema = Schema.Struct({
  entityType: Schema.Literals(['record', 'page']).annotate({
    description: 'What the result is: a record of a table, or a page',
  }),
  entityId: Schema.String.annotate({ description: 'Record id, or the page path' }),
  label: Schema.String.annotate({
    description: "The matched record's display value, or the page title",
  }),
  tableName: optionalField(
    Schema.String.annotate({ description: 'Table of a record result; absent for a page' })
  ),
  tableLabel: optionalField(
    Schema.String.annotate({
      description:
        "The table's plural label in the app's default language, for a record result; absent for a page",
    })
  ),
  favorited: Schema.Boolean.annotate({
    description: 'Whether the reader marked the record as a favourite',
  }),
  detailPath: optionalField(
    Schema.String.annotate({
      description: 'Where the result opens; absent when no page shows the record',
    })
  ),
  excerpt: optionalField(
    Schema.String.annotate({ description: 'Body text around the match, for a content page' })
  ),
  matchRange: optionalField(
    Schema.Tuple([Schema.Int, Schema.Int]).annotate({
      description: 'The [start, end) span of the match within excerpt',
    })
  ),
})

export const commandSearchResponseSchema = Schema.Array(commandSearchResultSchema).annotate({
  description:
    'Pages first, then records, each capped; an empty list for a query under two characters',
})

/** @public */
export type CommandSearchResultWire = Schema.Schema.Type<typeof commandSearchResultSchema>
