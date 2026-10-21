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
 * ─── THE NAME IS THE FIGURE ────────────────────────────────────────────────
 *
 * One 960 px layout the page scales, as the type's cover contract sets it:
 *
 * - the system's name sits bottom-left on the ground, inset one 32 px step
 *   from the edges, in a text block at most 440 px wide. It is sized from 120
 *   down to 64 px so its longest line fits 440 px, at an estimated 0.6 em a
 *   letter, on at most two lines that break only at a space or a hyphen the
 *   name already has. Its leading is 0.92;
 * - under it, one tagline line at 13 px in the muted foreground: the
 *   system's identity sentence, which the brand book below the cover then
 *   leaves out;
 * - the colour blocks fill the right half, from x = 480: the primary as a
 *   field over five eighths of it, then a column halving as it goes down;
 * - a name too wide for that zone even at 64 px, or whose tagline would not
 *   hold on one line in it, takes the top band skeleton
 *   instead: the blocks become one full-width band 112 px tall, and the name,
 *   at most 64 px, sits beneath it across the width less its insets.
 *
 * ─── DRAWN FROM THE TOKENS ALONE ───────────────────────────────────────────
 *
 * The blocks after the primary are the app's own brand colours (a colour that
 * is not a shadcn role), at most two, then `foreground`, `muted` and `border`
 * until there are four. Every fill is a token variable and no colour is a
 * literal, so the dark theme repaints the cover from the same file, and one
 * config gives one cover. The four-line derivation is kept as a comment
 * inside the SVG, as the type asks.
 */

/**
 * The card height, within the contract's 240 to 360 px, for both skeletons:
 * it holds two lines of a 120 px name and the tagline beside the blocks, or
 * the band, two lines of a 64 px name and the tagline under it.
 */
const COVER_HEIGHT = 320

const CANVAS_WIDTH = 960

/** Where the blocks start in the side-by-side skeleton: the right half. */
const BLOCKS_X = 480

/** The primary's share of the blocks' width, five eighths. */
const FIELD_SHARE = 5 / 8

/** The top band's height in the top band skeleton, within 96 to 120 px. */
const BAND_HEIGHT = 112

/** The inset of the text from the cover's edges, two 16 px steps. */
const INSET = 32

/** The widest the name's text block may be in the side-by-side skeleton. */
const TEXT_ZONE = 440

const MAX_NAME_SIZE = 120
const MIN_NAME_SIZE = 64

/** A name smaller than this on one line under the band takes two lines instead. */
const MIN_BAND_LINE_SIZE = 40

/** The sans estimate of a line's width, in em per letter. */
const EM_PER_LETTER = 0.6

const NAME_LEADING = 0.92
const TAGLINE_SIZE = 13

/** The sans estimate of the tagline's width: lower-case text runs narrower than the name's estimate. */
const TAGLINE_EM_PER_LETTER = 0.5
const TAGLINE_HEIGHT = 20
const TAGLINE_GAP = 8

/**
 * The system's identity sentence, the cover's tagline. The brand book under
 * the cover does not repeat it.
 */
const identitySentence = (appName: string): string =>
  `The design system of ${appName}, exported from its Sovrium config.`

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

/**
 * The ways the name can be set: on one line, then on two at each space or
 * hyphen it already has (a hyphen stays on the first line).
 */
const nameSplits = (name: string): readonly (readonly string[])[] => {
  const breaks = [...name.matchAll(/[ -]/g)].map((match) => match.index)
  return [
    [name],
    ...breaks.map((at) =>
      name.charAt(at) === '-'
        ? [name.slice(0, at + 1), name.slice(at + 1)]
        : [name.slice(0, at), name.slice(at + 1)]
    ),
  ].filter((lines) => lines.every((line) => line.trim().length > 0))
}

/** The largest whole px size, capped, at which every line fits `width`. */
const sizeFor = (lines: readonly string[], width: number, cap: number): number =>
  Math.min(cap, Math.floor(width / (EM_PER_LETTER * Math.max(...lines.map((line) => line.length)))))

interface NameSetting {
  readonly lines: number
  readonly size: number
}

/** The fewest lines that reach `floor`, else the largest size on any split. */
const setName = (name: string, width: number, cap: number, floor: number): NameSetting => {
  const settings = nameSplits(name).map((lines) => ({
    lines: lines.length,
    size: sizeFor(lines, width, cap),
  }))
  const best = settings
    .filter((setting) => setting.lines === 2)
    .reduce<NameSetting | undefined>(
      (found, setting) => (found === undefined || setting.size > found.size ? setting : found),
      undefined
    )
  const single = settings[0] ?? { lines: 1, size: 0 }
  return single.size >= floor || best === undefined || best.size <= single.size ? single : best
}

/** The SVG derivation comment and blocks of one skeleton. */
interface Skeleton {
  readonly height: number
  readonly svgHeight: number
  /** The widest the name's text block may be. */
  readonly textZone: number
  readonly derivation: readonly string[]
  readonly blocks: readonly Block[]
  readonly name: NameSetting
}

/** The blocks in the right half, the name in the 440 px zone beside them. */
const sideBySide = (blocks: readonly string[], name: NameSetting): Skeleton => {
  const [field = 'primary', second = 'foreground', third = 'muted', fourth = 'border'] = blocks
  const fieldWidth = (CANVAS_WIDTH - BLOCKS_X) * FIELD_SHARE
  const columnX = BLOCKS_X + fieldWidth
  const columnWidth = CANVAS_WIDTH - columnX
  const half = COVER_HEIGHT / 2
  const quarter = COVER_HEIGHT / 4
  return {
    height: COVER_HEIGHT,
    svgHeight: COVER_HEIGHT,
    textZone: TEXT_ZONE,
    name,
    derivation: [
      `blocks: ${blocks.join(', ')}`,
      `arrangement: side by side; the name bottom-left in a ${TEXT_ZONE} px zone, the blocks right of x = ${BLOCKS_X}, the primary as a field over five eighths of them, the others stacked in the column beside it`,
      'pattern: halving steps down the column, one half then two quarters',
      `scales: ${CANVAS_WIDTH} x ${COVER_HEIGHT} canvas; widths ${fieldWidth} and ${columnWidth}; heights ${COVER_HEIGHT}, ${half}, ${quarter} and ${quarter}; name ${name.size} px on ${name.lines} line(s), inset ${INSET}`,
    ],
    blocks: [
      { x: BLOCKS_X, y: 0, width: fieldWidth, height: COVER_HEIGHT, token: field },
      { x: columnX, y: 0, width: columnWidth, height: half, token: second },
      { x: columnX, y: half, width: columnWidth, height: quarter, token: third },
      { x: columnX, y: half + quarter, width: columnWidth, height: quarter, token: fourth },
    ],
  }
}

/** The blocks as one band across the top, the name beneath it across the width. */
const topBand = (blocks: readonly string[], name: NameSetting): Skeleton => {
  const [field = 'primary', second = 'foreground', third = 'muted', fourth = 'border'] = blocks
  const fieldWidth = CANVAS_WIDTH * FIELD_SHARE
  const rest = CANVAS_WIDTH - fieldWidth
  const half = rest / 2
  const quarter = rest / 4
  const height = COVER_HEIGHT
  return {
    height,
    svgHeight: BAND_HEIGHT,
    textZone: CANVAS_WIDTH - 2 * INSET,
    name,
    derivation: [
      `blocks: ${blocks.join(', ')}`,
      `arrangement: top band; the blocks one full-width band ${BAND_HEIGHT} px tall, the primary over five eighths of it, the name beneath it`,
      'pattern: halving steps along the band, one half then two quarters of the rest',
      `scales: ${CANVAS_WIDTH} x ${BAND_HEIGHT} band in a ${height} px card; widths ${fieldWidth}, ${half}, ${quarter} and ${quarter}; name ${name.size} px on ${name.lines} line(s), inset ${INSET}`,
    ],
    blocks: [
      { x: 0, y: 0, width: fieldWidth, height: BAND_HEIGHT, token: field },
      { x: fieldWidth, y: 0, width: half, height: BAND_HEIGHT, token: second },
      { x: fieldWidth + half, y: 0, width: quarter, height: BAND_HEIGHT, token: third },
      { x: fieldWidth + half + quarter, y: 0, width: quarter, height: BAND_HEIGHT, token: fourth },
    ],
  }
}

/**
 * The skeleton the name fits: side by side when the name reaches 64 px in the
 * zone and the tagline holds on one line there, else the top band.
 */
const skeletonFor = (appName: string, blocks: readonly string[]): Skeleton => {
  const side = setName(appName, TEXT_ZONE, MAX_NAME_SIZE, MIN_NAME_SIZE)
  const taglineWidth = identitySentence(appName).length * TAGLINE_EM_PER_LETTER * TAGLINE_SIZE
  return side.size >= MIN_NAME_SIZE && taglineWidth <= TEXT_ZONE
    ? sideBySide(blocks, side)
    : topBand(blocks, setName(appName, CANVAS_WIDTH - 2 * INSET, MIN_NAME_SIZE, MIN_BAND_LINE_SIZE))
}

/**
 * The cover card's `preview.html`. The name is one text run: the planned line
 * break is the browser's own wrap at a space or hyphen inside the text block,
 * which the size was chosen for.
 */
export const coverPreview = (appName: string, document: DesignSystemDocument): string => {
  const blocks = coverBlocks(document)
  const skeleton = skeletonFor(appName, blocks)
  return [
    `<!-- @dsCard height=${skeleton.height} -->`,
    `<div id="root" style="position:relative;width:${CANVAS_WIDTH}px;height:${skeleton.height}px;overflow:hidden;font-family:var(--font-sans, system-ui, sans-serif);color:var(--foreground);background:var(--background)">`,
    `  <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${skeleton.svgHeight}" viewBox="0 0 ${CANVAS_WIDTH} ${skeleton.svgHeight}" style="position:absolute;top:0;left:0;display:block" role="img" aria-label="${escapeHtml(appName)}">`,
    '    <!--',
    ...skeleton.derivation.map((line) => `      ${line}`),
    '    -->',
    ...skeleton.blocks.map(rect),
    '  </svg>',
    `  <div style="position:absolute;left:${INSET}px;bottom:${INSET}px;max-width:${skeleton.textZone}px">`,
    `    <p style="margin:0;font-size:${skeleton.name.size}px;line-height:${NAME_LEADING};font-weight:600;letter-spacing:-0.02em">${escapeHtml(appName)}</p>`,
    `    <p style="margin:${TAGLINE_GAP}px 0 0;font-size:${TAGLINE_SIZE}px;line-height:${TAGLINE_HEIGHT}px;color:var(--muted-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(identitySentence(appName))}</p>`,
    '  </div>',
    '</div>',
    '',
  ].join('\n')
}
