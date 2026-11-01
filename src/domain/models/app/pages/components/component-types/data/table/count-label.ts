/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The noun a grid counts its rows in, in the singular and the plural.
 *
 * A grid whose rows fit on one page draws no page navigation, only a count
 * line. Without a noun that line reads in the engine's own words ("3 rows") and
 * is left out at one row, because a one-row table embedded in a page needs no
 * count. Declaring a noun says the grid is a list of its own: the line then
 * counts in that noun and stays at one row ("1 user"). `{count}` in either form
 * is replaced by the number of rows.
 *
 * Two forms rather than one template, because every language the console
 * speaks inflects the noun, and the engine never guesses a plural.
 */
export const DataTableCountLabelSchema = Schema.Struct({
  one: Schema.String.annotate({
    description:
      'Count line for exactly one row. {count} is replaced by the number. Supports $t:key.',
    examples: ['{count} user', '{count} candidature'],
  }).check(Schema.isMinLength(1)),
  other: Schema.String.annotate({
    description:
      'Count line for any other number of rows, zero included. {count} is replaced by the number. Supports $t:key.',
    examples: ['{count} users', '{count} candidatures'],
  }).check(Schema.isMinLength(1)),
}).annotate({
  title: 'Table Count Label',
  description:
    'The noun the grid counts its rows in, as a singular (one) and a plural (other) line, each with a {count} token. Declaring it keeps the count line at one row; without it the line reads "N rows" and is left out at one row.',
  defaultNote: 'absent: the line reads "N rows", and is not drawn at one row',
})

/** @public */
export type DataTableCountLabel = Schema.Schema.Type<typeof DataTableCountLabelSchema>
