/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The names a PERSON reads for a table, beside the identifier a database reads.
 *
 * `name` is the table's identifier: the SQL table, the `/api/tables/{name}` path
 * segment, the key every relationship and automation names. It was also the only
 * name a table had, so the console, the command palette and the generated forms
 * printed `invoice_lines` at the people using the app. These two properties are
 * the human half, on the pattern of a field's `label`:
 *
 *   - `label` names ONE record's table — "Edit Invoice line".
 *   - `labelPlural` names the COLLECTION — a sidebar row, a directory entry, a
 *     grid's accessible name, "Create new record in Invoice lines".
 *
 * Fallback: `labelPlural` → `label` → `name`; `label` → `name`. The singular is
 * never derived from the plural (no inflection guessing), and the final fallback
 * is the raw `name`, exactly as a field without a `label` falls back.
 *
 * Addresses stay on the identifier: URLs, test ids, the palette's action id and
 * exported file names keep the `name`.
 *
 * Both accept a `$t:<key>` translation key. Empty strings are refused so a blank
 * label can never render as a blank heading. The description sits BEFORE the
 * check, where the JSON Schema renderer reads it.
 */
const displayName = (
  title: string,
  description: string,
  examples: readonly string[],
  message: string
) =>
  Schema.String.pipe(
    Schema.annotate({ title, description, examples }),
    Schema.check(Schema.isNonEmpty({ message }))
  )

/** `tables[].label` — the name of one record's table. */
export const TableLabelSchema = displayName(
  'Table Label',
  'The name a person reads for one record of this table, in place of the internal `name` — for example the accessible name of a generated edit form. May be a `$t:<key>` translation key, resolved against the active language. When unset, the table `name` is shown verbatim. The `name` stays the identifier used by the database, the API and file names.',
  ['Invoice line', 'Ligne de facture', '$t:tables.invoiceLines.one'],
  'label must not be empty'
)

/** `tables[].labelPlural` — the name of the table as a collection. */
export const TableLabelPluralSchema = displayName(
  'Table Plural Label',
  'The name a person reads for the table as a collection — the operator console sidebar and table directory, the record grid, the command palette "create" action. May be a `$t:<key>` translation key, resolved against the active language. When unset, `label` is used, then the table `name` verbatim.',
  ['Invoice lines', 'Lignes de facture', '$t:tables.invoiceLines.other'],
  'labelPlural must not be empty'
)
