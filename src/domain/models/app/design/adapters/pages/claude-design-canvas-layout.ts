/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where each board sits on the Claude Design canvas: one row per section of
 * the app (who may open its pages), under a note titling it, each section on
 * its own canvas page. In a row, each page is a column 80 px from the next;
 * in a column, the page's default board is on the row and each other board of
 * the page under the one before it.
 */

/** The gap between two boards, across a row and down a column. */
export const CANVAS_GAP = 80

/** The room above a row for the note titling its section. */
const NOTE_ROOM = 120

/** How far above its row a section's note sits. */
const NOTE_LIFT = 100

/** One board to place: the section and page it draws, and its size. */
export interface CanvasBoardSize {
  readonly sectionAt: number
  readonly pageAt: number
  readonly width: number
  readonly height: number
}

/** Where a board sits. */
export interface CanvasPlace {
  readonly x: number
  readonly y: number
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

/** The height of a column: its boards one under the other. */
const columnHeight = (boards: readonly CanvasBoardSize[]): number =>
  sum(boards.map((board) => board.height)) + CANVAS_GAP * Math.max(0, boards.length - 1)

/** Each section's top edge, in section order, every row under the one before it. */
const rowTopsOf = (boards: readonly CanvasBoardSize[], sections: number): readonly number[] =>
  Array.from({ length: sections }, (_, at) => at).reduce<readonly number[]>((tops, section) => {
    const previous = section - 1
    if (previous < 0) return [NOTE_ROOM]
    const pages = [...new Set(boards.filter((b) => b.sectionAt === previous).map((b) => b.pageAt))]
    const height = Math.max(
      0,
      ...pages.map((page) => columnHeight(boards.filter((b) => b.pageAt === page)))
    )
    return [...tops, (tops[previous] ?? 0) + height + CANVAS_GAP + NOTE_ROOM]
  }, [])

/**
 * The place of every board, in the order given, and the place of each
 * section's title note.
 *
 * @param boards - every board, in canvas order (a page's default board first).
 * @param sections - how many sections there are.
 */
export const canvasLayoutOf = (
  boards: readonly CanvasBoardSize[],
  sections: number
): { readonly boards: readonly CanvasPlace[]; readonly notes: readonly CanvasPlace[] } => {
  const tops = rowTopsOf(boards, sections)
  const columnWidth = (page: number): number =>
    Math.max(0, ...boards.filter((board) => board.pageAt === page).map((board) => board.width))
  const places = boards.map((board, at) => {
    const before = [
      ...new Set(
        boards
          .filter((other) => other.sectionAt === board.sectionAt && other.pageAt < board.pageAt)
          .map((other) => other.pageAt)
      ),
    ]
    const above = boards.slice(0, at).filter((other) => other.pageAt === board.pageAt)
    return {
      x: sum(before.map((page) => columnWidth(page) + CANVAS_GAP)),
      y: (tops[board.sectionAt] ?? 0) + sum(above.map((other) => other.height + CANVAS_GAP)),
    }
  })
  return { boards: places, notes: tops.map((top) => ({ x: 0, y: top - NOTE_LIFT })) }
}
