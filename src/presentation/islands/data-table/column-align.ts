/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An authored column `align`, as the classes its cells and its header carry.
 *
 * `columns[].align` decoded and then reached nothing: every cell and every
 * header stayed left-aligned, so an amount column told to sit on the right
 * still started at the left edge. A body cell aligns its text; a header cell
 * aligns its text AND its label row, because the label sits in a flex row
 * beside the sort glyph and `text-align` does not move a flex item.
 *
 * `left` (the default) contributes nothing, so an unaligned column renders
 * exactly as before. The class names are written out whole so the stylesheet
 * harvest finds them.
 */

export type ColumnAlign = 'left' | 'center' | 'right'

const CELL_ALIGN_CLASSES: Readonly<Record<ColumnAlign, string>> = {
  left: '',
  center: 'text-center',
  right: 'text-right',
}

const HEADER_LABEL_ALIGN_CLASSES: Readonly<Record<ColumnAlign, string>> = {
  left: '',
  center: 'justify-center',
  right: 'justify-end',
}

/** The text-alignment class of a cell (body or header) in this column. */
export function columnAlignClass(align: ColumnAlign | undefined): string {
  return align ? CELL_ALIGN_CLASSES[align] : ''
}

/** The alignment class of the flex row holding a header's label and sort glyph. */
export function headerLabelAlignClass(align: ColumnAlign | undefined): string {
  return align ? HEADER_LABEL_ALIGN_CLASSES[align] : ''
}
