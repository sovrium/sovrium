/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  parseHtmlElementTree,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import { componentFolderName } from '@/domain/models/app/design/adapters/export/claude-design-export'
import {
  PROTOTYPE_BOARD_FILE,
  prototypeBoardOf,
  type PrototypeStore,
  type PrototypeViewDrawing,
} from './claude-design-canvas-app'
import {
  boardPolicyOf,
  CANVAS_STAMP,
  drawnNode,
  drawnTextsOf,
  escapeText,
  imageOriginsOf,
  nodesById,
  serializeBoardNodes,
  type DrawContext,
} from './claude-design-canvas-draw'
import { CANVAS_GAP, canvasLayoutOf } from './claude-design-canvas-layout'
import { canvasBundlePath, type CanvasBundle } from './claude-design-canvas-mount'
import {
  BOARD_RENDER_VALUES,
  prototypeScriptOf,
  prototypeTargetOf,
  relativeBoardHref,
  type BoardPrototype,
  type PrototypeCatalog,
} from './claude-design-canvas-prototype'
import type {
  PageDesignTree,
  PageDesignTreeNode,
  PageExportStamp,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import type { AdapterFile } from '@/domain/models/app/design/adapters/export/adapter-export-values'
import type { CanvasLinkRoute } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-links'

/**
 * The Claude Design page adapter, export half: an app's pages drawn as a
 * Design CANVAS project (contract 0.2.47) under `adapters/claude-design/canvas/`,
 * the folder that stands for the canvas's `project/`.
 *
 * - `canvas.json`, the index at `v: 3`: one canvas page and one board per app
 *   page, laid out in a row, and a `designSystems` record naming the bundle's
 *   Claude Design project;
 * - `<page>/<Page>.dc.html`, one board per page: Sovrium's own drawing of the
 *   page inside `<x-dc>`, every design-tree node stamped;
 * - `pages.css`, the stylesheet the boards are painted with, linked from each;
 * - `ds/<namespace>/tokens.json`, the design system's tokens installed as the
 *   format installs one, beside its `fonts/` (copied by the bundle writer).
 *
 * ─── WHAT A BOARD STAMPS ───────────────────────────────────────────────────
 *
 * Each element drawn from a design-tree node carries `data-kit="<type>"` (the
 * repository's own canvas convention) and `data-sovrium-id="<path id>"`, and,
 * only where the tree has them, `data-kit-variant`, `data-kit-size`,
 * `data-kit-layout` (the node's OWN layout as utility classes, apart from the
 * classes its component paints with), `data-kit-content` (its text is literal
 * copy a designer may rewrite) and `data-kit-locked` (a template, a library
 * block, a reference or an island: drawn, never read back). No other element
 * carries `data-kit`, so an unstamped `data-kit` element is one a designer
 * added. The board's root carries the page name and the EXPORT STAMP: every
 * node drawn, with its key and content hash, which is how an import tells a
 * deletion from a node the config gained after the export.
 *
 * ─── NOTHING SOVRIUM-SPECIFIC TO EDIT ──────────────────────────────────────
 *
 * The drawing is rewritten before it is written: no script, no test id, no
 * translation key or translated copy table, no entrance animation, no link to
 * a page path (every `href` becomes `#`, a link inside the app naming its
 * target in `data-sovrium-href` and `data-sovrium-page`, see
 * `claude-design-canvas-links.ts`), no attribute holding a network address
 * (but the `https://` source of an image a node of the tree draws), no `data:` source, and a binding left in drawn text (`$currentUser.name`)
 * becomes a placeholder (`[name]`). Bindings, visibility, data sources and
 * interactions stay in the bundle's node map.
 *
 * ─── REPRODUCIBLE ──────────────────────────────────────────────────────────
 *
 * No clock: `createdOnFiles.at` and the record's `copiedAt` are the Unix epoch.
 * The index is written as the editor re-saves it (one-space indentation, no
 * trailing newline), so opening and saving an unedited canvas changes nothing.
 */

/** Where the canvas project goes, inside the bundle. */
export const CLAUDE_DESIGN_CANVAS_DIR = 'adapters/claude-design/canvas'

export { CANVAS_STAMP } from './claude-design-canvas-draw'

/** The stamp document of a board: the canvas's stamp file holds one per board. */
export const CANVAS_STAMP_FORMAT = 'sovrium.design-system.page-export'

/** The canvas file holding every board's export stamp, beside `canvas.json`. */
export const CANVAS_STAMP_FILE = 'sovrium-export.json'

/** One more board of a page, drawn at a state other than its default. */
export interface ClaudeDesignCanvasBoard {
  /** The state it draws, `<key>=<value>`, which its root carries as `data-sovrium-state`. */
  readonly state: string
  /** Its title on the canvas. */
  readonly title: string
  /** Its drawing, as {@link ClaudeDesignCanvasPage.body}. */
  readonly body: string
  /** The nodes it draws, as {@link ClaudeDesignCanvasPage.exported}. */
  readonly exported: PageExportStamp
  /** Its width, when it is not {@link CANVAS_BOARD_WIDTH}. */
  readonly width?: number | undefined
  /** `dark` draws the board in the dark token values. */
  readonly theme?: 'light' | 'dark' | undefined
  /** What the board plays, on a clickable canvas. */
  readonly prototype?: BoardPrototype | undefined
}

/** One page to draw: its design tree, its stamp, and the body the renderer drew. */
export interface ClaudeDesignCanvasPage {
  readonly tree: PageDesignTree
  readonly exported: PageExportStamp
  /** The page's drawing, the markup inside its `<main>`, every tree node stamped `data-sovrium-id`. */
  readonly body: string
  /** The default board's title on the canvas; absent, `<app> · <page>`. */
  readonly title?: string | undefined
  /** The page's other boards, each under the one before it. */
  readonly boards?: readonly ClaudeDesignCanvasBoard[] | undefined
  /** The section of the app the page is in, one canvas row; absent, a row of its own. */
  readonly section?: { readonly id: string; readonly title: string } | undefined
  /** What its default board plays, on a clickable canvas. */
  readonly prototype?: BoardPrototype | undefined
  /** The record its default board draws, for a routed record page. */
  readonly record?: string | undefined
  /** What each node does, as the attributes its elements carry, by node id. */
  readonly rules?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
}

/** What the canvas adapter reads. */
export interface ClaudeDesignCanvasInput {
  readonly appName: string
  /** Every page of the app, exported or not: where a board link inside the app leads. */
  readonly routes: readonly CanvasLinkRoute[]
  /** The codes of the languages the app is served in, each a segment a link's address may open with. */
  readonly languages?: readonly string[] | undefined
  readonly pages: readonly ClaudeDesignCanvasPage[]
  /** The text of the Claude Design project's `tokens.json`, installed as the canvas's design system. */
  readonly tokens: string
  /** The stylesheet the pages are drawn with; its fonts are named under `../fonts/`. */
  readonly stylesheet: string
  /**
   * Each board's height as it is drawn at its width, in canvas order (each
   * page's default board, then its other boards), when it was measured; an
   * unmeasured board's height is estimated from the nodes its page draws.
   */
  readonly heights?: readonly (number | undefined)[]
  /** The design system's bundle the boards mount, installed under `ds/<folder>/`. */
  readonly bundle?: CanvasBundle | undefined
  /** Draw a clickable canvas: links lead board to board, and each board plays. */
  readonly prototype?: boolean | undefined
  /**
   * The boards draw values the config does not hold (seeded rows, a role's
   * account, a state): record the text each bound node drew, so reading the
   * canvas back tells a drawn value from an edit.
   */
  readonly recordTexts?: boolean | undefined
  /** The stateful prototype (`--prototype=app`): one Prototype board over one store. */
  readonly app?:
    | {
        readonly views: readonly Omit<PrototypeViewDrawing, 'tree'>[]
        readonly store: PrototypeStore
        readonly roles: readonly string[]
      }
    | undefined
}

/** One board of the canvas, in canvas order. */
interface DrawnBoard {
  readonly page: ClaudeDesignCanvasPage
  readonly pageAt: number
  readonly state: string | undefined
  readonly title: string
  readonly body: string
  readonly exported: PageExportStamp
  readonly width: number
  readonly theme: 'light' | 'dark' | undefined
  readonly prototype: BoardPrototype | undefined
}

/** Every board of the canvas: each page's default board, then its other boards. */
const drawnBoardsOf = (input: ClaudeDesignCanvasInput): readonly DrawnBoard[] =>
  input.pages.flatMap((page, pageAt) => [
    {
      page,
      pageAt,
      state: undefined,
      title: page.title ?? `${input.appName} · ${page.tree.page}`,
      body: page.body,
      exported: page.exported,
      width: CANVAS_BOARD_WIDTH,
      theme: undefined,
      prototype: page.prototype,
    },
    ...(page.boards ?? []).map((board) => ({
      page,
      pageAt,
      state: board.state,
      title: board.title,
      body: board.body,
      exported: board.exported,
      width: board.width ?? CANVAS_BOARD_WIDTH,
      theme: board.theme,
      prototype: board.prototype,
    })),
  ])

/** The app page each board of the canvas draws, in canvas order. */
export const canvasBoardPagesOf = (input: ClaudeDesignCanvasInput): readonly string[] =>
  drawnBoardsOf(input).map((board) => board.page.tree.page)

/** The Unix epoch, the reproducible-build spelling of "no date". */
const NO_DATE = '1970-01-01T00:00:00Z'

/** A PAGE board's width; the format asks 1280–1440 for a page. */
export const CANVAS_BOARD_WIDTH = 1280

/** The gap between two boards, as the format lays them out. */
const BOARD_GAP = CANVAS_GAP

/** The format's limits on a board's size, and on a page id. */
const MIN_BOARD = 40
/** The tallest board the format draws. */
export const CANVAS_BOARD_LIMIT = 8000
const MAX_BOARD = CANVAS_BOARD_LIMIT
const MAX_PAGE_ID = 40

/**
 * The folder a canvas installs the design system under: lower case, each run
 * of other characters one `-`, no leading `-` or `_`, 64 at most.
 */
export const canvasNamespaceOf = (appName: string): string => {
  const folder = appName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 64)
  return /^[a-z0-9]/.test(folder) ? folder : 'sovrium'
}

/** Where one of the design system's fonts goes inside the canvas, relative to the bundle. */
export const canvasFontPath = (appName: string, fileName: string): string =>
  `${CLAUDE_DESIGN_CANVAS_DIR}/ds/${canvasNamespaceOf(appName)}/fonts/${fileName}`

/** How many nodes a tree draws, to size its board. */
const countNodes = (nodes: readonly PageDesignTreeNode[]): number =>
  nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)

/** A page board's height at its width, estimated from what it draws; a page board grows to fit. */
const boardHeightOf = (tree: PageDesignTree): number =>
  Math.min(MAX_BOARD, Math.max(MIN_BOARD * 10, 160 + 96 * countNodes(tree.nodes)))

/** Where a board sits among the others: its file, and every board a link may reach. */
interface BoardFrame {
  readonly file: string
  readonly catalog: PrototypeCatalog
}

/** The board's component: the canvas's empty one, or the one that plays a clickable board. */
const componentOf = (
  input: ClaudeDesignCanvasInput,
  board: DrawnBoard,
  frame: BoardFrame
): readonly string[] =>
  input.prototype === true && board.prototype !== undefined
    ? prototypeScriptOf(
        frame.catalog,
        { file: frame.file, page: board.page.tree.page },
        board.prototype
      )
    : ['class Component extends DCLogic {', '  renderVals() {', BOARD_RENDER_VALUES, '  }', '}']

/** A board's drawing, rewritten for the canvas: links, stamps, mounted components. */
const drawnBodyOf = (
  input: ClaudeDesignCanvasInput,
  board: DrawnBoard,
  frame: BoardFrame
): readonly HtmlNode[] => {
  const { page } = board
  const parsed = parseHtmlElementTree(board.body)
  const context: DrawContext = {
    byId: nodesById(page.tree.nodes),
    rules: page.rules,
    links: {
      routes: input.routes,
      page: page.tree.page,
      languages: input.languages,
      ...(input.prototype === true
        ? {
            hrefOf: (target: string) => {
              const file = prototypeTargetOf(frame.catalog, page.tree.page, target)
              return file === undefined ? undefined : relativeBoardHref(frame.file, file)
            },
          }
        : {}),
    },
    bundle: input.bundle,
  }
  return parsed.ok ? parsed.nodes.flatMap((node) => drawnNode(context, node)) : []
}

/** One board: the format's skeleton around the stamped drawing. */
const boardOf = (
  input: ClaudeDesignCanvasInput,
  board: DrawnBoard,
  height: number,
  frame: BoardFrame
): string => {
  const { appName } = input
  const { page } = board
  const body = drawnBodyOf(input, board, frame)
  const root: HtmlElementNode = {
    kind: 'element',
    tag: 'div',
    attributes: {
      class: `${board.theme === 'dark' ? 'dark ' : ''}bg-background text-foreground`,
      [CANVAS_STAMP.page]: page.tree.page,
      ...(board.state === undefined ? {} : { [CANVAS_STAMP.state]: board.state }),
    },
    children: [{ kind: 'element', tag: 'main', attributes: {}, children: body }],
  }
  const drawn = serializeBoardNodes([root])
  const props = JSON.stringify({ $preview: { width: board.width, height } })
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${boardPolicyOf(imageOriginsOf(drawn))}">`,
    `<title>${escapeText(`${page.tree.page} · ${appName}`)}</title>`,
    '<script src="./support.js"></script>',
    ...(input.bundle === undefined
      ? []
      : [`<script src="../${canvasBundlePath(canvasNamespaceOf(appName))}"></script>`]),
    '<link rel="stylesheet" href="../pages.css">',
    '</head>',
    '<body>',
    '<x-dc>',
    '<helmet>',
    '<style>',
    'body{margin:0}',
    '</style>',
    '</helmet>',
    drawn,
    '</x-dc>',
    `<script type="text/x-dc" data-dc-script data-props='${props}'>`,
    ...componentOf(input, board, frame),
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** A canvas page id for a page name: the format allows 40 characters. */
const pageIdOf = (name: string, index: number): string =>
  name.length <= MAX_PAGE_ID ? name : `${name.slice(0, MAX_PAGE_ID - 5)}-${index}`

/**
 * Each board's path, `<page id>/<Page>.dc.html` for a page's default board and
 * `<page id>/<Page><State>.dc.html` for another, every stem unique.
 */
const boardPathsOf = (
  boards: readonly { readonly id: string; readonly state: string | undefined }[]
): readonly string[] =>
  boards.reduce<readonly string[]>((paths, { id, state }) => {
    const stem = componentFolderName(state === undefined ? id : `${id} ${state}`)
    const taken = (candidate: string) =>
      paths.some((path) => path.endsWith(`/${candidate}.dc.html`))
    const unique = taken(stem) ? `${stem}${paths.length + 1}` : stem
    return [...paths, `${id}/${unique}.dc.html`]
  }, [])

/**
 * The board file of every board of every page, by page, as the canvas writes
 * them: each page's default board (state `undefined`) first.
 */
export const canvasBoardFilesOf = (
  pages: readonly { readonly page: string; readonly states: readonly (string | undefined)[] }[]
): readonly (readonly string[])[] => {
  const ids = pages.map((page, index) => pageIdOf(page.page, index))
  const flat = pages.flatMap((page, at) =>
    page.states.map((state) => ({ id: ids[at] ?? '', state }))
  )
  const paths = boardPathsOf(flat)
  return pages.reduce<{ readonly from: number; readonly files: readonly (readonly string[])[] }>(
    ({ from, files }, page) => ({
      from: from + page.states.length,
      files: [...files, paths.slice(from, from + page.states.length)],
    }),
    { from: 0, files: [] }
  ).files
}

/** A stylesheet that stays offline: no `@import`, no `url()` reaching the network. */
const isOfflineStylesheet = (css: string): boolean =>
  !/@import\b/i.test(css) && !/url\(\s*["']?\s*(?:https?:)?\/\//i.test(css)

/** The stylesheet with its fonts named where the canvas installs them. */
const canvasStylesheetOf = (appName: string, css: string): string =>
  css.replace(
    /url\((\s*["']?)\.\.\/fonts\//g,
    (_match: string, quote: string) => `url(${quote}ds/${canvasNamespaceOf(appName)}/fonts/`
  )

/** The sections of the canvas, one per row, in the order their first page comes. */
const sectionsOf = (
  input: ClaudeDesignCanvasInput,
  ids: readonly string[]
): readonly { readonly id: string; readonly title: string }[] => {
  const all = input.pages.map(
    (page, at) => page.section ?? { id: ids[at] ?? page.tree.page, title: page.tree.page }
  )
  return all.filter((section, at) => all.findIndex((other) => other.id === section.id) === at)
}

/** Every board placed: its file, its place and its size, in canvas order. */
const placedBoardsOf = (input: ClaudeDesignCanvasInput, ids: readonly string[]) => {
  const boards = drawnBoardsOf(input)
  const sections = sectionsOf(input, ids)
  const sectionOf = (board: DrawnBoard): number =>
    sections.findIndex((section) => section.id === (board.page.section?.id ?? ids[board.pageAt]))
  const paths = boardPathsOf(
    boards.map((board) => ({ id: ids[board.pageAt] ?? '', state: board.state }))
  )
  const drawn = boards.map((board, at) => input.heights?.[at] ?? boardHeightOf(board.page.tree))
  // A measured height is the board's own, however short; only the cap applies.
  const heights = drawn.map((height) => Math.min(MAX_BOARD, Math.max(1, height)))
  const layout = canvasLayoutOf(
    boards.map((board, at) => ({
      sectionAt: sectionOf(board),
      pageAt: board.pageAt,
      width: board.width,
      height: heights[at] ?? MIN_BOARD,
    })),
    sections.length
  )
  const placed = boards.map((board, at) => ({
    board,
    path: paths[at] ?? '',
    drawn: drawn[at] ?? MIN_BOARD,
    height: heights[at] ?? MIN_BOARD,
    place: layout.boards[at] ?? { x: 0, y: 0 },
    section: sections[sectionOf(board)]?.id ?? '',
  }))
  return { placed, sections, notes: layout.notes }
}

/** Every board of the canvas placed, its sections and their notes. */
type CanvasLayout = Readonly<ReturnType<typeof placedBoardsOf>>

/** What the round-trip note says: where the guide to importing the canvas back is. */
const ROUND_TRIP_NOTE =
  "Before editing, read the project's SOVRIUM.md: what an edit brings back into the app's config, what it keeps, and what it refuses."

/** Where the round-trip note sits: level with the first section's title, right of it. */
const ROUND_TRIP_NOTE_PLACE = { x: 640, y: 20 }

/** The canvas notes: the round-trip guide, each section's title above its row, what a capped board cuts. */
const notesOf = (
  ids: readonly string[],
  layout: CanvasLayout
): Readonly<Record<string, { readonly x: number; readonly y: number; readonly text: string }>> =>
  Object.fromEntries([
    // The guide to what comes back, beside the first section's title.
    ['round-trip', { ...ROUND_TRIP_NOTE_PLACE, text: ROUND_TRIP_NOTE }],
    ...layout.sections.map((section, at) => [
      `section-${section.id}`,
      { ...(layout.notes[at] ?? { x: 0, y: 0 }), text: section.title },
    ]),
    ...layout.placed.flatMap(({ board, drawn, place }) =>
      drawn <= MAX_BOARD
        ? []
        : [
            [
              `cut-${ids[board.pageAt] ?? ''}${board.state === undefined ? '' : `-${board.state}`}`,
              {
                x: place.x,
                y: place.y + MAX_BOARD + BOARD_GAP,
                text:
                  `${board.page.tree.page} is drawn ${String(drawn)}px tall: ` +
                  `this board shows its first ${String(MAX_BOARD)}px, and the rest is cut.`,
              },
            ],
          ]
    ),
  ])

/** The canvas index: one canvas page per section, every board on its section's page. */
const canvasIndexOf = (
  input: ClaudeDesignCanvasInput,
  ids: readonly string[],
  layout: CanvasLayout
) => ({
  v: 3,
  createdOnFiles: { at: NO_DATE, v: 1 },
  title: input.appName,
  launch: {
    view: 'canvas',
    ...(layout.sections[0] === undefined ? {} : { page: layout.sections[0].id }),
  },
  pages: layout.sections.map((section) => ({ id: section.id, name: section.title })),
  boards: Object.fromEntries(
    layout.placed.map(({ board, path, height, place, section }) => [
      path,
      {
        x: place.x,
        y: place.y,
        w: board.width,
        h: height,
        title: board.title,
        page: section,
        expand: 'fill',
        ...(input.prototype === true ? { is_interactive: true } : {}),
      },
    ])
  ),
  order: layout.placed.map(({ path }) => path),
  notes: notesOf(ids, layout),
  designSystems: [
    /* eslint-disable unicorn/no-null -- JSON values the canvas format requires */
    // The format writes an unknown address and version as JSON null; the
    // person's own install of the published project replaces this record.
    {
      title: input.appName,
      namespace: canvasNamespaceOf(input.appName),
      artifact: null,
      version: null,
      copiedAt: NO_DATE,
    },
    /* eslint-enable unicorn/no-null -- the record ends here */
  ],
  attachments: {},
})

/**
 * The stamp file: every board's export stamp, by board file — the page it
 * draws, its state, and every node it draws with key and content hash, which
 * is how an import tells a deletion from a node the config gained after the
 * export, and the text it drew where the config keeps none, which is how it
 * tells a value the export drew from an edit. It sits beside the index rather
 * than on the boards, which carry nothing a designer could take for a property
 * to edit.
 */
const stampFileOf = (input: ClaudeDesignCanvasInput, layout: CanvasLayout): string =>
  JSON.stringify(
    {
      format: CANVAS_STAMP_FORMAT,
      version: 1,
      boards: Object.fromEntries(
        layout.placed.map(({ board, path }) => {
          const texts =
            input.recordTexts === true
              ? drawnTextsOf(
                  drawnBodyOf(input, board, { file: path, catalog: catalogOf(input, layout) })
                )
              : {}
          return [
            path,
            {
              page: board.page.tree.page,
              ...(board.state === undefined ? {} : { state: board.state }),
              exported: board.exported,
              ...(Object.keys(texts).length === 0 ? {} : { texts }),
            },
          ]
        })
      ),
    },
    undefined,
    1
  )

/** Where the Prototype board sits: a row of its own, under every other row. */
const prototypePlaceOf = (input: ClaudeDesignCanvasInput, layout: CanvasLayout) => {
  const bottom = Math.max(0, ...layout.placed.map(({ place, height }) => place.y + height))
  const fallback = Math.max(MIN_BOARD, ...layout.placed.map(({ height }) => height))
  const y = bottom + BOARD_GAP + PROTOTYPE_NOTE_ROOM
  return {
    x: 0,
    y,
    w: CANVAS_BOARD_WIDTH,
    h: Math.min(MAX_BOARD, input.heights?.[layout.placed.length] ?? fallback),
    note: { x: 0, y: y - PROTOTYPE_NOTE_ROOM + 20, text: 'Prototype' },
  }
}

/** The room above the Prototype board for its note. */
const PROTOTYPE_NOTE_ROOM = 120

/** The index with the Prototype board added: its canvas page, its board, its note. */
const withPrototypeBoard = (
  input: ClaudeDesignCanvasInput,
  layout: CanvasLayout,
  index: Readonly<ReturnType<typeof canvasIndexOf>>
) => {
  if (input.app === undefined) return index
  const { note, ...place } = prototypePlaceOf(input, layout)
  return {
    ...index,
    pages: [...index.pages, { id: 'prototype', name: 'Prototype' }],
    boards: {
      ...index.boards,
      [PROTOTYPE_BOARD_FILE]: {
        ...place,
        title: 'Prototype',
        page: 'prototype',
        expand: 'fill',
        is_interactive: true,
      },
    },
    order: [...index.order, PROTOTYPE_BOARD_FILE],
    notes: { ...index.notes, 'section-prototype': note },
  }
}

/** The Prototype board's file, when the canvas has one. */
const prototypeFilesOf = (
  input: ClaudeDesignCanvasInput,
  layout: CanvasLayout
): readonly AdapterFile[] => {
  if (input.app === undefined) return []
  const trees = new Map(input.pages.map((page) => [page.tree.page, page.tree] as const))
  const place = prototypePlaceOf(input, layout)
  return [
    {
      path: `${CLAUDE_DESIGN_CANVAS_DIR}/${PROTOTYPE_BOARD_FILE}`,
      content: prototypeBoardOf({
        appName: input.appName,
        routes: input.routes,
        bundle: input.bundle,
        ...(input.bundle === undefined
          ? {}
          : { bundleScript: `../${canvasBundlePath(canvasNamespaceOf(input.appName))}` }),
        views: input.app.views.flatMap((view) => {
          const tree = trees.get(view.view.page)
          return tree === undefined ? [] : [{ ...view, tree }]
        }),
        store: input.app.store,
        roles: input.app.roles,
        catalog: catalogOf(input, layout),
        width: place.w,
        height: place.h,
      }),
    },
  ]
}

/** Every board of the canvas, as a prototype's link reaches it. */
const catalogOf = (input: ClaudeDesignCanvasInput, layout: CanvasLayout): PrototypeCatalog => ({
  routes: input.routes,
  languages: input.languages,
  boards: layout.placed.map(({ board, path }) => ({
    file: path,
    page: board.page.tree.page,
    state: board.state,
  })),
  defaultRecords: Object.fromEntries(
    input.pages.flatMap((page) =>
      page.record === undefined ? [] : [[page.tree.page, page.record] as const]
    )
  ),
})

/**
 * Every text file of the canvas project, the index first. The font files the
 * stylesheet names are binary and copied by the bundle writer, at
 * {@link canvasFontPath}, as is the design system's bundle script, at
 * `ds/<folder>/components/bundle.js`.
 */
export const claudeDesignCanvasFiles = (input: ClaudeDesignCanvasInput): readonly AdapterFile[] => {
  const ids = input.pages.map((page, index) => pageIdOf(page.tree.page, index))
  const layout = placedBoardsOf(input, ids)
  const namespace = canvasNamespaceOf(input.appName)
  const stylesheet = isOfflineStylesheet(input.stylesheet)
    ? [
        {
          path: `${CLAUDE_DESIGN_CANVAS_DIR}/pages.css`,
          content: canvasStylesheetOf(input.appName, input.stylesheet),
        },
      ]
    : []
  return [
    {
      path: `${CLAUDE_DESIGN_CANVAS_DIR}/canvas.json`,
      content: JSON.stringify(
        withPrototypeBoard(input, layout, canvasIndexOf(input, ids, layout)),
        undefined,
        1
      ),
    },
    ...layout.placed.map(({ board, path, height }) => ({
      path: `${CLAUDE_DESIGN_CANVAS_DIR}/${path}`,
      content: boardOf(input, board, height, { file: path, catalog: catalogOf(input, layout) }),
    })),
    ...prototypeFilesOf(input, layout),
    ...stylesheet,
    {
      path: `${CLAUDE_DESIGN_CANVAS_DIR}/${CANVAS_STAMP_FILE}`,
      content: stampFileOf(input, layout),
    },
    { path: `${CLAUDE_DESIGN_CANVAS_DIR}/ds/${namespace}/tokens.json`, content: input.tokens },
  ]
}
