/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Matrix → SVG.
 *
 * ONE run-merged `<path>`, not one `<rect>` per module. A 45×45 symbol carries
 * roughly a thousand dark modules: as separate rects that is ~60 KB and a
 * thousand DOM nodes; merged into horizontal runs it is ~12 KB and one node.
 * The difference matters most where the markup is inlined into a page.
 *
 * Output is DETERMINISTIC — no generated ids, no timestamps — which is what lets
 * the `.svg` route be cached immutably and tests assert exact strings.
 */

/** Options with product defaults already applied. */
export interface QrSvgOptions {
  /** Quiet-zone width in modules. The spec's minimum is 4. */
  readonly quietZone?: number
  /** Dark module colour. */
  readonly dark?: string
  /** Light colour. PAINTED, not omitted — see below. */
  readonly light?: string
  /** Accessible name. A QR matrix is otherwise opaque to a screen reader. */
  readonly title?: string
  /** Intrinsic pixel size. Omit to let CSS size it. */
  readonly size?: number
}

/** Horizontal runs of dark modules in one row, as `[start, length]` pairs. */
const runsInRow = (row: readonly boolean[]): ReadonlyArray<readonly [number, number]> =>
  row.reduce<ReadonlyArray<readonly [number, number]>>((runs, dark, index) => {
    if (!dark) return runs
    const last = runs.at(-1)
    if (last !== undefined && last[0] + last[1] === index) {
      return [...runs.slice(0, -1), [last[0], last[1] + 1] as const]
    }
    return [...runs, [index, 1] as const]
  }, [])

const escapeText = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Render a module matrix as a standalone SVG document. */
export const matrixToSvg = (
  matrix: readonly (readonly boolean[])[],
  options: QrSvgOptions = {}
): string => {
  const quiet = options.quietZone ?? 4
  const dark = options.dark ?? '#000000'
  const light = options.light ?? '#ffffff'
  const modules = matrix.length
  const extent = modules + quiet * 2

  const path = matrix
    .flatMap((row, y) =>
      runsInRow(row).map(
        ([start, length]) => `M${start + quiet} ${y + quiet}h${length}v1h-${length}z`
      )
    )
    .join('')

  const dimensions =
    options.size === undefined ? '' : ` width="${options.size}" height="${options.size}"`
  const title = options.title === undefined ? '' : `<title>${escapeText(options.title)}</title>`

  // The quiet zone is PAINTED rather than left transparent: a transparent symbol
  // on a dark background is unscannable, and that failure only shows up on
  // whichever page happens to be dark.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"${dimensions}`,
    ` role="img" shape-rendering="crispEdges">`,
    title,
    `<rect width="${extent}" height="${extent}" fill="${light}"/>`,
    `<path fill="${dark}" d="${path}"/>`,
    `</svg>`,
  ].join('')
}
