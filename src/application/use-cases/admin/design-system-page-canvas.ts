/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bundle's Claude Design canvas: the exported pages handed to the canvas
 * adapter (`claude-design-canvas-export.ts`), and the design system's fonts
 * copied beside the tokens the canvas installs.
 *
 * Only the `--pages` export calls it, so a bundle without pages carries no
 * canvas and is byte-identical to one built before the page export existed.
 */

import { Effect, Option } from 'effect'
import { PageMeasure } from '@/application/ports/services/page-measure'
import {
  CANVAS_BOARD_LIMIT,
  CANVAS_BOARD_WIDTH,
  CLAUDE_DESIGN_CANVAS_DIR,
  type ClaudeDesignCanvasInput,
  canvasBoardPagesOf,
  canvasFontPath,
  canvasNamespaceOf,
  claudeDesignCanvasFiles,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-export'
import {
  canvasBundleOf,
  canvasBundlePath,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-mount'
import { canvasRulesOf } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-rules'
import {
  PAGE_ROUND_TRIP_TABLES,
  ROUND_TRIP_GUIDE_FILE,
  roundTripGuideOf,
} from '@/domain/models/app/pages/page-round-trip-guide-service'
import {
  textEntry,
  type DesignSystemBundle,
  type DesignSystemBundleEntry,
} from './design-system-bundle'
import type { ProjectedPage } from './design-system-page-projection'
import type { PageExportStamp } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { App } from '@/domain/models/app'
import type { BoardPrototype } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-prototype'

/** The Claude Design project's tokens, which the canvas installs as its design system. */
const PROJECT_TOKENS = 'adapters/claude-design/project/tokens.json'

/** The round-trip guide, beside the Claude Design project's own README. */
const PROJECT_GUIDE = `adapters/claude-design/project/${ROUND_TRIP_GUIDE_FILE}`

/** The Claude Design project's component bundle, which the canvas installs for its boards to mount. */
const PROJECT_BUNDLE = 'adapters/claude-design/project/components/bundle.js'

/** The project's bundle script, and its copy installed on the canvas; none without one. */
const installedBundleOf = (app: App, bundle: DesignSystemBundle) => {
  const script = bundle.files.find((file) => file.path === PROJECT_BUNDLE)
  const read = script === undefined ? undefined : canvasBundleOf(decoder.decode(script.bytes))
  if (script === undefined || read === undefined) return { bundle: undefined, files: [] }
  const path = `${CLAUDE_DESIGN_CANVAS_DIR}/${canvasBundlePath(canvasNamespaceOf(app.name))}`
  return { bundle: read, files: [{ ...script, path, role: 'adapter' as const }] }
}

/** One more board of a drawn page: its state, its title and the markup drawn inside `<main>`. */
export interface DrawnBoard {
  readonly state: string
  readonly title: string
  readonly body: string
  readonly width?: number | undefined
  readonly theme?: 'light' | 'dark' | undefined
  readonly prototype?: BoardPrototype | undefined
  /** The page's nodes the board draws; absent, every node. */
  readonly drawnIds?: ReadonlySet<string> | undefined
}

/** One drawn page: its projection, the markup the renderer drew inside `<main>`, its other boards. */
export interface DrawnPage {
  readonly projected: ProjectedPage
  readonly body: string
  readonly title?: string | undefined
  /** The nodes its default board draws; absent, every node. */
  readonly drawnIds?: ReadonlySet<string> | undefined
  readonly boards?: readonly DrawnBoard[] | undefined
  /** The section of the app it is in: one canvas row and one canvas page. */
  readonly section?: { readonly id: string; readonly title: string } | undefined
  /** What its default board plays, on a clickable canvas. */
  readonly prototype?: BoardPrototype | undefined
  /** The record its default board draws, for a routed record page. */
  readonly record?: string | undefined
}

/**
 * A board's export stamp: every node of the page's node map it draws, with key
 * and content hash. A node the board does not draw (a branch of another state)
 * is not in it, so an import reads its absence as no change.
 */
export const stampOf = (
  projected: ProjectedPage,
  drawnIds?: ReadonlySet<string>
): PageExportStamp =>
  projected.map.nodes
    .filter((node) => drawnIds === undefined || drawnIds.has(node.id))
    .map((node) => ({
      id: node.id,
      ...(node.key === undefined ? {} : { key: node.key }),
      contentHash: node.contentHash,
    }))

const decoder = new TextDecoder()

/**
 * Each board's drawn height at its own width, measured on the boards as
 * written, when the runtime provides a {@link PageMeasure}; none otherwise.
 */
const measuredHeights = (
  files: readonly DesignSystemBundleEntry[],
  boards: readonly string[],
  widths: readonly number[]
) =>
  Effect.gen(function* () {
    const measure = yield* Effect.serviceOption(PageMeasure)
    if (Option.isNone(measure)) return []
    const root = `${CLAUDE_DESIGN_CANVAS_DIR}/`
    const loaded = files
      .filter((file) => file.path.startsWith(root))
      .map((file) => ({ path: file.path.slice(root.length), bytes: file.bytes }))
    const byWidth = yield* Effect.forEach([...new Set(widths)], (width) =>
      Effect.map(
        measure.value.drawnHeights({
          files: loaded,
          documents: boards.flatMap((board, at) =>
            widths[at] === width ? [board.slice(root.length)] : []
          ),
          width,
        }),
        (heights) => ({ width, heights })
      )
    )
    return boards.map((_board, at) => {
      const measured = byWidth.find((group) => group.width === widths[at])
      const index = widths.slice(0, at).filter((width) => width === widths[at]).length
      return measured?.heights[index]
    })
  })

/** What the canvas adapter reads of the drawn pages: each with its boards and its stamp. */
const canvasInputOf = (
  app: App,
  pages: readonly DrawnPage[],
  paint: { readonly tokens: string; readonly stylesheet: string }
) => ({
  appName: app.name,
  routes: (app.pages ?? []).map((page) => ({ name: page.name, path: page.path })),
  pages: pages.map((page) => ({
    tree: page.projected.tree,
    exported: stampOf(page.projected, page.drawnIds),
    body: page.body,
    title: page.title,
    section: page.section,
    prototype: page.prototype,
    record: page.record,
    rules: canvasRulesOf(
      page.projected.map,
      ((app.pages ?? []).find((entry) => entry.name === page.projected.tree.page) ??
        {}) as Readonly<Record<string, unknown>>
    ),
    boards: (page.boards ?? []).map(({ drawnIds, ...board }) => ({
      ...board,
      exported: stampOf(page.projected, drawnIds),
    })),
  })),
  ...paint,
})

/** The design system's fonts, copied where the canvas installs them. */
const canvasFontsOf = (app: App, bundle: DesignSystemBundle) =>
  bundle.files
    .filter((file) => file.role === 'font' && file.path.startsWith('fonts/'))
    .map((font) => ({
      ...font,
      path: canvasFontPath(app.name, font.path.slice('fonts/'.length)),
      role: 'adapter' as const,
    }))

/** Each board's width, in canvas order, the Prototype board's last. */
const boardWidthsOf = (pages: readonly DrawnPage[], prototype: boolean): readonly number[] => [
  ...pages.flatMap((page) => [
    CANVAS_BOARD_WIDTH,
    ...(page.boards ?? []).map((board) => board.width ?? CANVAS_BOARD_WIDTH),
  ]),
  ...(prototype ? [CANVAS_BOARD_WIDTH] : []),
]

/** One notice per board drawn taller than a board can be. */
const cutNoticesOf = (
  boardPages: readonly string[],
  heights: readonly (number | undefined)[]
): readonly string[] =>
  heights.flatMap((height, at) =>
    height === undefined || height <= CANVAS_BOARD_LIMIT
      ? []
      : [
          `Note: page ${boardPages[at] ?? ''} is drawn ${String(height)} px ` +
            `tall, over the canvas's ${String(CANVAS_BOARD_LIMIT)} px board limit: its board ` +
            'shows the top of it, and a canvas note says what is cut.',
        ]
  )

/**
 * The canvas files of a pages export, read from the bundle they join, and one
 * notice per page drawn taller than a board can be.
 *
 * Each board is as tall as its page is drawn at the board width: the boards
 * are written once, measured, and written again with those heights. A page
 * over the format's board limit gets a board at the limit and a canvas note
 * saying what is cut.
 *
 * @param app - the validated config.
 * @param bundle - the bundle without its pages.
 * @param pages - each exported page, in config order.
 * @param drawnWith - the pages stylesheet, as `pages/pages.css` carries it, and
 *   the canvas's copies of the images the pages draw.
 */
export const canvasEntriesOf = (
  app: App,
  bundle: DesignSystemBundle,
  pages: readonly DrawnPage[],
  drawnWith: {
    readonly stylesheet: string
    readonly assets: readonly DesignSystemBundleEntry[]
    /** A clickable canvas (`--prototype`): links lead board to board, each board plays. */
    readonly prototype?: boolean | undefined
    /** The stateful prototype's views and store (`--prototype=app`). */
    readonly app?: ClaudeDesignCanvasInput['app']
    /** The boards draw values the config does not hold: record what each bound node drew. */
    readonly recordTexts?: boolean | undefined
  }
) =>
  Effect.gen(function* () {
    const tokens = bundle.files.find((file) => file.path === PROJECT_TOKENS)
    const fonts = canvasFontsOf(app, bundle)
    const installed = installedBundleOf(app, bundle)
    const input = {
      ...canvasInputOf(app, pages, {
        tokens: tokens === undefined ? '{}\n' : decoder.decode(tokens.bytes),
        stylesheet: drawnWith.stylesheet,
      }),
      bundle: installed.bundle,
      prototype: drawnWith.prototype,
      app: drawnWith.app,
      recordTexts: drawnWith.recordTexts,
    }
    const entriesOf = (files: ReturnType<typeof claudeDesignCanvasFiles>) =>
      files.map((file) => textEntry(file.path, 'adapter', file.content))
    const estimated = entriesOf(claudeDesignCanvasFiles(input))
    const boards = estimated.filter((file) => file.path.endsWith('.dc.html')).map((f) => f.path)
    const widths = boardWidthsOf(pages, drawnWith.app !== undefined)
    const heights = yield* measuredHeights(
      [...estimated, ...fonts, ...installed.files, ...drawnWith.assets],
      boards,
      widths
    )
    const notices = cutNoticesOf(canvasBoardPagesOf(input), heights)
    const files = [
      ...entriesOf(claudeDesignCanvasFiles({ ...input, heights })),
      ...fonts,
      ...installed.files,
      textEntry(PROJECT_GUIDE, 'adapter', roundTripGuideOf(PAGE_ROUND_TRIP_TABLES)),
    ]
    return { files, notices }
  }).pipe(
    Effect.withSpan('design-system.page-canvas', { attributes: { 'design.pages': pages.length } })
  )
