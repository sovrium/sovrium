/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SHADCN_COLOR_ROLES } from '@/domain/models/app/design/inherited-tokens'
import type { DesignSystemDocument } from '@/domain/models/api/admin/design-system/design-system'

/**
 * The cover of the Claude Design project: `components/Cover/preview.html`,
 * the card a Design System artifact shows above its brand book (contract
 * 0.2.47).
 *
 * The folder holds that one file. A README or a types file beside it would
 * make `Cover` an ordinary component, and the system would have no cover.
 *
 * ─── DRAWN FROM THE TOKENS ALONE ───────────────────────────────────────────
 *
 * Four colour blocks in one inline SVG, at one 960 px layout the page scales:
 *
 * - the primary, as a field over five eighths of the width;
 * - beside it a column halving as it goes down: the next block takes half the
 *   column, the last two a quarter each;
 * - the blocks after the primary are the app's own brand colours (a colour
 *   that is not a shadcn role), at most two, then `foreground`, `muted` and
 *   `border` until there are four.
 *
 * Every fill is a token variable and no colour is a literal, so the dark theme
 * repaints the cover from the same file, and one config gives one cover. The
 * system's name is text under the SVG. The four-line derivation is kept as a
 * comment inside the SVG, as the type asks.
 */

/** The card height, from 240 to 360 px: the SVG, then the name under it. */
const COVER_HEIGHT = 320

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 240
const FIELD_WIDTH = 600

/** The neutral roles that fill the cover when the app declares fewer brand colours. */
const NEUTRAL_BLOCKS = ['foreground', 'muted', 'border'] as const

/** The most brand colours the cover shows beside the primary. */
const MAX_BRAND_BLOCKS = 2

const BLOCK_COUNT = 4

const shadcnRoles: ReadonlySet<string> = new Set(SHADCN_COLOR_ROLES)

/** A colour the app brings on top of the shadcn roles, such as `signal`. */
const isBrandColour = (name: string): boolean =>
  !shadcnRoles.has(name) &&
  name !== 'primary' &&
  !name.endsWith('-foreground') &&
  !name.startsWith('chart-') &&
  !name.startsWith('sidebar')

/** A token name safe inside `var(--…)`. */
const isVariableName = (name: string): boolean => /^[A-Za-z0-9-]+$/.test(name)

/** The cover's blocks, in drawing order: the primary first. */
export const coverBlocks = (document: DesignSystemDocument): readonly string[] => {
  const names = Object.keys(document.color).filter(isVariableName)
  const brand = names.filter(isBrandColour).slice(0, MAX_BRAND_BLOCKS)
  return [...new Set(['primary', ...brand, ...NEUTRAL_BLOCKS])].slice(0, BLOCK_COUNT)
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Where one block sits on the canvas, and the token it is filled with. */
interface Block {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly token: string
}

/** One block: a rectangle filled by a token variable. */
const rect = ({ x, y, width, height, token }: Block): string =>
  `    <rect x="${x}" y="${y}" width="${width}" height="${height}" style="fill:var(--${token})"/>`

/** The cover card's `preview.html`. */
export const coverPreview = (appName: string, document: DesignSystemDocument): string => {
  const blocks = coverBlocks(document)
  const columnX = FIELD_WIDTH
  const columnWidth = CANVAS_WIDTH - FIELD_WIDTH
  const half = CANVAS_HEIGHT / 2
  const quarter = CANVAS_HEIGHT / 4
  const [field = 'primary', second = 'foreground', third = 'muted', fourth = 'border'] = blocks
  return [
    `<!-- @dsCard height=${COVER_HEIGHT} -->`,
    '<div id="root" style="width:960px;font-family:var(--font-sans, system-ui, sans-serif);color:var(--foreground)">',
    `  <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" role="img" aria-label="${escapeHtml(appName)}">`,
    '    <!--',
    `      blocks: ${blocks.join(', ')}`,
    '      arrangement: the primary as a field over five eighths of the width, the others stacked in the column beside it',
    '      pattern: halving steps down the column, one half then two quarters',
    `      scales: ${CANVAS_WIDTH} x ${CANVAS_HEIGHT} canvas; widths ${FIELD_WIDTH} and ${columnWidth}; heights ${CANVAS_HEIGHT}, ${half}, ${quarter} and ${quarter}`,
    '    -->',
    rect({ x: 0, y: 0, width: FIELD_WIDTH, height: CANVAS_HEIGHT, token: field }),
    rect({ x: columnX, y: 0, width: columnWidth, height: half, token: second }),
    rect({ x: columnX, y: half, width: columnWidth, height: quarter, token: third }),
    rect({ x: columnX, y: half + quarter, width: columnWidth, height: quarter, token: fourth }),
    '  </svg>',
    `  <p style="margin:16px 0 0;font-size:32px;line-height:48px;font-weight:600">${escapeHtml(appName)}</p>`,
    '</div>',
    '',
  ].join('\n')
}
