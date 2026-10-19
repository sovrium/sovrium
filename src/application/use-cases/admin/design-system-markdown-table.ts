/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The table and section primitives the design-system brief is assembled from
 * (`design-system-markdown.ts`): every authored value placed in a cell goes
 * through the canonical escaping, and every body line through the line-break
 * fold, so no value can open a row or a heading the brief never declared.
 */

import { escapeMarkdownTableCell, foldLineBreaks } from '@/domain/kernel/markdown/markdown-escaping'

/** A rendered section: its H2 title and its body lines, or nothing to say. */
export interface Section {
  readonly title: string
  readonly lines: readonly string[]
}

/**
 * A value placed in a table cell, escaped through the canonical helper.
 *
 * Pipe is the column separator, backslash is the escape character, and a
 * newline ends the row — all three are authored values here, since token
 * descriptions and voice rules come from the app config.
 */
const cell = (text: string | undefined): string => escapeMarkdownTableCell(text ?? '')

/** A markdown table with a fixed header. */
export const table = (
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): readonly string[] => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
]

/** Drop sections with no rows — an empty H2 is chrome, which this format has none of. */
export const renderSections = (sections: readonly Section[]): readonly string[] =>
  sections.flatMap(({ title, lines }) =>
    lines.length > 0 ? [`## ${title}`, '', ...lines.map(foldLineBreaks), ''] : []
  )

/** A dimension rendered for a table cell, or an empty cell when it is absent. */
export const formatOptionalMeasure = (
  value: { readonly value: number; readonly unit: string } | undefined
): string => (value === undefined ? '' : formatMeasure(value))

/** `{value: 4, unit: 'rem'}` → `4rem`. */
export const formatMeasure = (value: { readonly value: number; readonly unit: string }): string =>
  `${value.value}${value.unit}`
