/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * WHERE A WORKBOOK'S REFERENCES POINT ONCE A TEMPLATE ROW HAS REPEATED.
 *
 * A row loop of `n` items turns one template row into `n` rows, so every row
 * below it moves down by `n − 1`. A reference follows the cells it names, the
 * way Excel's own row insertion does:
 *
 * - a cell below the template row moves down with it (absolute or not);
 * - a range that covers the template row grows to cover every repeated row
 *   (`SUM(D5:D5)` → `SUM(D5:D7)`);
 * - inside the repeated row itself, copy `k` reads as Excel's copy would:
 *   each RELATIVE row reference moves by `k` (`B5*C5` → `B6*C6`), an
 *   absolute one (`$B$5`) stays.
 *
 * A reference to another sheet (`Terms!A1`) is left alone — only this sheet's
 * rows move — and so is anything inside a quoted string.
 */

/** One repeated template row: its row number in the template, and the rows it added. */
export interface RowInsertion {
  readonly row: number
  readonly added: number
}

const REFERENCE =
  /(?<![A-Za-z0-9_.!$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?(?![A-Za-z0-9_(])/g

/** Where row `row` of the template ends up once every insertion above it is made. */
export const movedRow = (row: number, insertions: ReadonlyArray<RowInsertion>): number =>
  row +
  insertions
    .filter((insertion) => insertion.row < row)
    .reduce((sum, insertion) => sum + insertion.added, 0)

/** Rows a range ending at `row` grows by when `row` itself is a repeated template row. */
const grownAt = (row: number, insertions: ReadonlyArray<RowInsertion>): number =>
  insertions
    .filter((insertion) => insertion.row === row)
    .reduce((sum, insertion) => sum + insertion.added, 0)

/** How a reference moves: the insertions above it, and `copy` rows for a relative row. */
interface Move {
  readonly insertions: ReadonlyArray<RowInsertion>
  readonly copy: number
}

const rowOf = (absolute: string, row: string, move: Move, extra = 0): string =>
  String(movedRow(Number(row), move.insertions) + extra + (absolute === '' ? move.copy : 0))

const moveReference = (move: Move) =>
  ((...groups: ReadonlyArray<string | undefined>): string => {
    const [, c1, col1, r1, row1, c2, col2, r2, row2] = groups.map((g) => g ?? '')
    const first = `${c1}${col1}${r1}${rowOf(r1 ?? '', row1 ?? '0', move)}`
    if (col2 === '') return first
    const grown = grownAt(Number(row2), move.insertions)
    return `${first}:${c2}${col2}${r2}${rowOf(r2 ?? '', row2 ?? '0', move, grown)}`
  }) as (substring: string, ...args: ReadonlyArray<unknown>) => string

/** A formula (or a range such as a merge) with its references moved; quoted text kept. */
export const moveReferences = (
  formula: string,
  insertions: ReadonlyArray<RowInsertion>,
  copy = 0
): string =>
  formula
    .split('"')
    .map((piece, index) =>
      index % 2 === 1 ? piece : piece.replace(REFERENCE, moveReference({ insertions, copy }))
    )
    .join('"')
