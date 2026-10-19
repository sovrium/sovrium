/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE place a table's human name is resolved — the singular / plural pair
 * every surface that names a table to a person reads (`table-display-name.ts`
 * holds the two schemas).
 *
 *   - {@link tableLabel} names ONE record's table: `label` → `name`.
 *   - {@link tableLabelPlural} names the COLLECTION: `labelPlural` → `label` →
 *     `name`.
 *
 * The singular is never derived from the plural, and the final fallback is the
 * raw `name`, verbatim — an app that declares no label renders exactly what it
 * rendered before labels existed.
 *
 * A declared label may be a `$t:<key>`; the caller passes the translator for
 * ITS language (the page's, the console's), because this module cannot know
 * which one the surface speaks. The `name` is an identifier, never translated.
 */

/** The parts of a table its display names are read from. */
export interface TableDisplayNames {
  readonly name: string
  readonly label?: string | undefined
  readonly labelPlural?: string | undefined
}

/** Turns a declared label (plain text or a `$t:<key>`) into text in one language. */
export type TableLabelTranslator = (text: string) => string

const verbatim: TableLabelTranslator = (text) => text

/** The name of one record's table: its `label`, else its `name`. */
export function tableLabel(
  table: TableDisplayNames,
  translate: TableLabelTranslator = verbatim
): string {
  return table.label === undefined ? table.name : translate(table.label)
}

/** The name of the table as a collection: `labelPlural`, else `label`, else `name`. */
export function tableLabelPlural(
  table: TableDisplayNames,
  translate: TableLabelTranslator = verbatim
): string {
  const declared = table.labelPlural ?? table.label
  return declared === undefined ? table.name : translate(declared)
}

/** Both names of a table, resolved to text: `{ label, labelPlural }`. */
export function resolvedTableLabels(
  table: TableDisplayNames,
  translate: TableLabelTranslator
): { readonly label: string; readonly labelPlural: string } {
  return { label: tableLabel(table, translate), labelPlural: tableLabelPlural(table, translate) }
}
