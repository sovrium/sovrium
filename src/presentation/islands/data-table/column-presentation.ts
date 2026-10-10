/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { matchesConditionOperators } from '@/domain/models/app/tables/condition-operators'
import { cn } from '@/presentation/design/class-merge'
import type { CellMeta } from './data-row-types'
import type {
  CellStyleCondition,
  FieldColumn,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tone } from '@/domain/models/app/pages/components/shared-schemas'
import type { CSSProperties } from 'react'

/**
 * A cell tone's ink, on the cell, on the option chip drawn inside it, and on a
 * value that carries an ink of its own (`data-cell-ink` — the text a formula
 * spells), which inheriting the cell's colour would not reach.
 *
 * The chip carries its option's paint as an INLINE style, so reaching it takes
 * an important utility: that is the one way a class beats an inline colour.
 * Spelled out whole so the scan-free compiler sees every literal.
 */
const TONE_CELL: Readonly<Record<Tone, string>> = {
  success:
    'text-success [&_[data-component-type=badge]]:text-success! [&_[data-cell-ink]]:text-success',
  warning:
    'text-warning [&_[data-component-type=badge]]:text-warning! [&_[data-cell-ink]]:text-warning',
  error: 'text-error [&_[data-component-type=badge]]:text-error! [&_[data-cell-ink]]:text-error',
  muted:
    'text-foreground-muted [&_[data-component-type=badge]]:text-foreground-muted! [&_[data-cell-ink]]:text-foreground-muted',
}

/**
 * `truncate: true` — the cell's content holds one line, cut with an ellipsis
 * at the column's width. The width is read from a custom property the cell
 * carries, because a table cell ignores its own `max-width`: the bound has to
 * sit on the content. An entry that sets a glyph before its link
 * (`data-cell-entry`, a file) stays a row, so the glyph keeps the link's line.
 */
const TRUNCATE = [
  'max-w-[var(--sv-cell-width,20rem)] truncate',
  '[&>*]:block [&>*]:max-w-[var(--sv-cell-width,20rem)] [&>*]:truncate',
  '[&_a]:block [&_a]:max-w-[var(--sv-cell-width,20rem)] [&_a]:truncate',
  '[&>[data-cell-entry]]:flex',
].join(' ')

/**
 * The classes of the first `cellStyle` rule the value matches: its `className`,
 * then its `tone`.
 *
 * @param value - The cell value.
 * @param conditions - The column's `cellStyle` rules.
 */
export function evaluateCellStyle(
  value: unknown,
  conditions: readonly CellStyleCondition[]
): string {
  const matched = conditions.find((condition) => matchesConditionOperators(condition.when, value))
  if (matched === undefined) return ''
  return cn(matched.className, matched.tone === undefined ? undefined : TONE_CELL[matched.tone])
}

/**
 * The tone of the first `cellStyle` rule the value matches, if that rule names one.
 *
 * @param value - The cell value.
 * @param conditions - The column's `cellStyle` rules.
 */
export const matchedCellTone = (
  value: unknown,
  conditions: readonly CellStyleCondition[] | undefined
): Tone | undefined =>
  conditions?.find((condition) => matchesConditionOperators(condition.when, value))?.tone

/** What a column's presentation keys add to one of its cells. */
export interface CellPresentation {
  readonly className: string
  readonly title?: string
  readonly style?: CSSProperties
}

/**
 * A cell's presentation: its `cellStyle` classes and, for a `truncate` column,
 * the one-line bound plus the full value as the cell's tooltip.
 *
 * @param meta - The column's meta.
 * @param value - The cell value.
 */
export function cellPresentation(meta: CellMeta, value: unknown): CellPresentation {
  const styled = meta?.cellStyle ? evaluateCellStyle(value, meta.cellStyle) : ''
  if (meta?.truncate !== true) return { className: styled }
  const width = meta.authoredWidth
  return {
    className: cn(TRUNCATE, styled),
    ...(value === null || value === undefined || value === '' ? {} : { title: String(value) }),
    ...(width === undefined
      ? {}
      : { style: { ['--sv-cell-width' as string]: `${String(width)}px` } as CSSProperties }),
  }
}

/**
 * A cell's `style` and `title`: the presentation's own, under the pin a frozen
 * column adds.
 *
 * @param presentation - The cell's presentation.
 * @param pinStyle - The frozen column's pin, if any.
 */
export const presentationAttributes = (
  presentation: CellPresentation,
  pinStyle: CSSProperties | undefined
): { readonly style?: CSSProperties; readonly title?: string } => ({
  ...(pinStyle || presentation.style ? { style: { ...presentation.style, ...pinStyle } } : {}),
  ...(presentation.title === undefined ? {} : { title: presentation.title }),
})

/**
 * The presentation keys a field column carries into its column meta.
 *
 * @param col - The field column.
 */
export const columnPresentationMeta = (
  col: FieldColumn
): { readonly cellStyle?: readonly CellStyleCondition[]; readonly truncate?: boolean } => ({
  cellStyle: cellStyleOutsideChip(col),
  truncate: col.truncate,
})

/**
 * The `cellStyle` rules as they apply to the cell around the value. A column
 * drawn as a chip (`badgeForm`) gives a rule's `tone` to the chip alone, so the
 * cell keeps only the rule's `className` — the tone never recolours the text.
 * A text chip takes the tone itself (`text-chip-cell.tsx`); an option chip
 * takes it from the wrapper {@link optionChipCellClassOf} draws around it.
 */
export const cellStyleOutsideChip = (
  col: Pick<FieldColumn, 'badgeForm' | 'cellStyle'>
): readonly CellStyleCondition[] | undefined =>
  col.badgeForm === undefined || col.cellStyle === undefined
    ? col.cellStyle
    : col.cellStyle.map(({ tone: _tone, ...rule }) => rule)

/** The field types whose own renderer draws a chip from their options. */
const OPTION_CHIP_TYPES: ReadonlySet<string> = new Set(['status', 'single-select', 'multi-select'])

/**
 * Whether a column draws its value as a text chip: it asks for one
 * (`badgeForm`) over a field with no option chip of its own — a text, a
 * formula — so the chip wins over that field type's own renderer.
 */
export const drawsTextChip = (
  col: Pick<FieldColumn, 'badgeForm'>,
  fieldType: string | undefined
): boolean => col.badgeForm !== undefined && !OPTION_CHIP_TYPES.has(fieldType ?? '')

/** The classes a value cell takes from its column's `cellStyle` (tone kept for the chip). */
export const cellClassOf = (
  value: unknown,
  col: Pick<FieldColumn, 'badgeForm' | 'cellStyle'>
): string => {
  const rules = cellStyleOutsideChip(col)
  return rules ? evaluateCellStyle(value, rules) : ''
}

/**
 * The classes around an option field's own chip (`status`, `single-select`,
 * `multi-select`): every matching rule whole, its `tone` included. The tone's
 * classes reach the chip inside the wrapper through an important utility (see
 * `TONE_CELL`), which beats the option's inline paint — so an option column
 * drawn with `badgeForm` keeps the colour its `cellStyle` asks for.
 */
export const optionChipCellClassOf = (
  value: unknown,
  col: Pick<FieldColumn, 'cellStyle'>
): string => (col.cellStyle ? evaluateCellStyle(value, col.cellStyle) : '')
