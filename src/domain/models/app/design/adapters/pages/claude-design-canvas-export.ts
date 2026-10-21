/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  parseHtmlElementTree,
  serializeHtmlNodes,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import { componentFolderName } from '@/domain/models/app/design/adapters/export/claude-design-export'
import {
  boardLinkAttributes,
  isNetworkAddress,
  type CanvasLinkContext,
  type CanvasLinkRoute,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-links'
import { layoutClassNameOf } from '@/domain/models/app/pages/page-layout-service'
import type {
  PageDesignTree,
  PageDesignTreeNode,
  PageExportStamp,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import type { AdapterFile } from '@/domain/models/app/design/adapters/export/adapter-export-values'

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
 * `claude-design-canvas-links.ts`), no attribute holding a network address, no
 * `data:` source, and a binding left in drawn text (`$currentUser.name`)
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

/** The attributes a board stamps; the parse half reads exactly these. */
export const CANVAS_STAMP = {
  kit: 'data-kit',
  id: 'data-sovrium-id',
  variant: 'data-kit-variant',
  size: 'data-kit-size',
  layout: 'data-kit-layout',
  content: 'data-kit-content',
  locked: 'data-kit-locked',
  page: 'data-sovrium-page',
  stamp: 'data-sovrium-export',
} as const

/** The stamp document a board's root carries. */
export const CANVAS_STAMP_FORMAT = 'sovrium.design-system.page-export'

/** One page to draw: its design tree, its stamp, and the body the renderer drew. */
export interface ClaudeDesignCanvasPage {
  readonly tree: PageDesignTree
  readonly exported: PageExportStamp
  /** The page's drawing, the markup inside its `<main>`, every tree node stamped `data-sovrium-id`. */
  readonly body: string
}

/** What the canvas adapter reads. */
export interface ClaudeDesignCanvasInput {
  readonly appName: string
  /** Every page of the app, exported or not: where a board link inside the app leads. */
  readonly routes: readonly CanvasLinkRoute[]
  readonly pages: readonly ClaudeDesignCanvasPage[]
  /** The text of the Claude Design project's `tokens.json`, installed as the canvas's design system. */
  readonly tokens: string
  /** The stylesheet the pages are drawn with; its fonts are named under `../fonts/`. */
  readonly stylesheet: string
}

/** The Unix epoch, the reproducible-build spelling of "no date". */
const NO_DATE = '1970-01-01T00:00:00Z'

/** A PAGE board's width; the format asks 1280–1440 for a page. */
const BOARD_WIDTH = 1280

/** The gap between two boards of a row, as the format lays them out. */
const BOARD_GAP = 80

/** The format's limits on a board's size, and on a page id. */
const MIN_BOARD = 40
const MAX_BOARD = 8000
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

/** The elements a board never carries: scripts, styles, embeds and document metadata. */
const DROPPED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'noscript',
  'template',
])

/** The attributes the renderer writes for Sovrium's own runtime and tests, never drawn. */
const DROPPED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'data-testid',
  'data-translation-key',
  'data-translations',
  'data-component',
  'data-component-type',
  'data-type',
  'srcdoc',
  'formaction',
  'action',
])

/** The attributes that name a resource. */
const SOURCE_ATTRIBUTES: ReadonlySet<string> = new Set(['src', 'srcset', 'poster', 'xlink:href'])

/** A binding or an unresolved variable left in drawn text: `$currentUser.name`, `$label`. */
const EXPRESSION = /\$t:([\w.-]+)|\$[A-Za-z_]\w*(?:\.(\w+))*/g

/** Drawn text with every expression replaced by a placeholder naming what it reads. */
const withPlaceholders = (text: string): string =>
  text.replace(EXPRESSION, (match: string, key?: string, last?: string) => {
    const name = key?.split('.').at(-1) ?? last ?? match.slice(1)
    return `[${name}]`
  })

/** A resource reference a board may keep: relative, never a scheme, never the site root. */
const isLocalReference = (value: string): boolean => !/^\s*(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value)

const ownAttribute = (name: string): boolean =>
  name.startsWith('data-sovrium-') || name === 'data-kit' || name.startsWith('data-kit-')

/** A namespace declaration names a vocabulary, never a resource a board would fetch. */
const isNamespace = (name: string): boolean => name === 'xmlns' || name.startsWith('xmlns:')

/** An attribute a board never carries: a handler, Sovrium's own, or a network address. */
const isDroppedAttribute = (name: string, value: string): boolean =>
  name.startsWith('on') ||
  DROPPED_ATTRIBUTES.has(name) ||
  ownAttribute(name) ||
  (isNetworkAddress(value) && !isNamespace(name) && name !== 'href')

/** An element's attributes as a board draws them. */
const drawnAttributes = (
  attributes: Readonly<Record<string, string>>,
  links: CanvasLinkContext
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(attributes).flatMap(([name, value]): readonly (readonly [string, string])[] => {
      if (isDroppedAttribute(name, value)) return []
      if (name === 'href') return boardLinkAttributes(value, links)
      if (SOURCE_ATTRIBUTES.has(name)) return isLocalReference(value) ? [[name, value]] : []
      if (name === 'class') {
        const kept = value
          .split(/\s+/)
          .filter((token) => token !== '' && !token.startsWith('animate-'))
        return kept.length === 0 ? [] : [[name, kept.join(' ')]]
      }
      return [[name, withPlaceholders(value)]]
    })
  )

/** The stamps of one tree node, as a board's attributes. */
const stampsOf = (node: PageDesignTreeNode): Readonly<Record<string, string>> => {
  const layout = layoutClassNameOf(node.layout, node.responsive)
  return {
    [CANVAS_STAMP.kit]: node.type,
    [CANVAS_STAMP.id]: node.id,
    ...(node.variant === undefined ? {} : { [CANVAS_STAMP.variant]: node.variant }),
    ...(node.size === undefined ? {} : { [CANVAS_STAMP.size]: node.size }),
    ...(layout === '' ? {} : { [CANVAS_STAMP.layout]: layout }),
    ...(node.content === undefined ? {} : { [CANVAS_STAMP.content]: '' }),
    ...(node.locked === undefined ? {} : { [CANVAS_STAMP.locked]: node.locked }),
  }
}

/** Every node of a tree, by id. */
const nodesById = (nodes: readonly PageDesignTreeNode[]): ReadonlyMap<string, PageDesignTreeNode> =>
  new Map(nodes.flatMap((node) => [[node.id, node] as const, ...nodesById(node.children)]))

/**
 * A tree node whose element a board never carries (an `iframe`): an empty box
 * in its place, its size and stamps kept, so the node is still on the board and
 * is not read back as deleted.
 */
const standInOf = (
  node: HtmlElementNode,
  treeNode: PageDesignTreeNode,
  links: CanvasLinkContext
): HtmlElementNode => {
  const { class: className, style } = node.attributes
  return {
    kind: 'element',
    tag: 'div',
    attributes: {
      ...drawnAttributes(
        {
          ...(className === undefined ? {} : { class: className }),
          ...(style === undefined ? {} : { style }),
        },
        links
      ),
      ...stampsOf(treeNode),
    },
    children: [],
  }
}

/** One drawn node rewritten for a board, tree nodes stamped. */
const drawnNode = (
  byId: ReadonlyMap<string, PageDesignTreeNode>,
  links: CanvasLinkContext,
  node: HtmlNode
): readonly HtmlNode[] => {
  if (node.kind === 'text') return [{ kind: 'text', text: withPlaceholders(node.text) }]
  const treeNode = byId.get(node.attributes[CANVAS_STAMP.id] ?? '')
  if (DROPPED_TAGS.has(node.tag)) {
    return treeNode === undefined ? [] : [standInOf(node, treeNode, links)]
  }
  const element: HtmlElementNode = {
    kind: 'element',
    tag: node.tag,
    attributes: {
      ...drawnAttributes(node.attributes, links),
      ...(treeNode === undefined ? {} : stampsOf(treeNode)),
    },
    children: node.children.flatMap((child) => drawnNode(byId, links, child)),
  }
  return [element]
}

/** How many nodes a tree draws, to size its board. */
const countNodes = (nodes: readonly PageDesignTreeNode[]): number =>
  nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0)

/** A page board's height at its width, estimated from what it draws; a page board grows to fit. */
const boardHeightOf = (tree: PageDesignTree): number =>
  Math.min(MAX_BOARD, Math.max(MIN_BOARD * 10, 160 + 96 * countNodes(tree.nodes)))

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** The board of one page: the format's skeleton around the stamped drawing. */
const boardOf = (
  input: ClaudeDesignCanvasInput,
  page: ClaudeDesignCanvasPage,
  height: number
): string => {
  const { appName } = input
  const parsed = parseHtmlElementTree(page.body)
  const byId = nodesById(page.tree.nodes)
  const links: CanvasLinkContext = { routes: input.routes, page: page.tree.page }
  const body = parsed.ok ? parsed.nodes.flatMap((node) => drawnNode(byId, links, node)) : []
  const stamp = {
    format: CANVAS_STAMP_FORMAT,
    version: 1,
    page: page.tree.page,
    exported: page.exported,
  }
  const root: HtmlElementNode = {
    kind: 'element',
    tag: 'div',
    attributes: {
      class: 'bg-background text-foreground',
      [CANVAS_STAMP.page]: page.tree.page,
      [CANVAS_STAMP.stamp]: JSON.stringify(stamp),
    },
    children: [{ kind: 'element', tag: 'main', attributes: {}, children: body }],
  }
  const props = JSON.stringify({ $preview: { width: BOARD_WIDTH, height } })
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeText(`${page.tree.page} · ${appName}`)}</title>`,
    '<script src="./support.js"></script>',
    '<link rel="stylesheet" href="../pages.css">',
    '</head>',
    '<body>',
    '<x-dc>',
    '<helmet>',
    '<style>',
    'body{margin:0}',
    '</style>',
    '</helmet>',
    serializeHtmlNodes([root]),
    '</x-dc>',
    `<script type="text/x-dc" data-dc-script data-props='${props}'>`,
    'class Component extends DCLogic {',
    '  renderVals() {',
    '    return {};',
    '  }',
    '}',
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** A canvas page id for a page name: the format allows 40 characters. */
const pageIdOf = (name: string, index: number): string =>
  name.length <= MAX_PAGE_ID ? name : `${name.slice(0, MAX_PAGE_ID - 5)}-${index}`

/** Each page's board path, `<page id>/<Page>.dc.html`, every stem unique. */
const boardPathsOf = (ids: readonly string[]): readonly string[] =>
  ids.reduce<readonly string[]>((paths, id) => {
    const stem = componentFolderName(id)
    const taken = (candidate: string) =>
      paths.some((path) => path.endsWith(`/${candidate}.dc.html`))
    const unique = taken(stem) ? `${stem}${paths.length + 1}` : stem
    return [...paths, `${id}/${unique}.dc.html`]
  }, [])

/** A stylesheet that stays offline: no `@import`, no `url()` reaching the network. */
const isOfflineStylesheet = (css: string): boolean =>
  !/@import\b/i.test(css) && !/url\(\s*["']?\s*(?:https?:)?\/\//i.test(css)

/** The stylesheet with its fonts named where the canvas installs them. */
const canvasStylesheetOf = (appName: string, css: string): string =>
  css.replace(
    /url\((\s*["']?)\.\.\/fonts\//g,
    (_match: string, quote: string) => `url(${quote}ds/${canvasNamespaceOf(appName)}/fonts/`
  )

/**
 * Every text file of the canvas project, the index first. The font files the
 * stylesheet names are binary and copied by the bundle writer, at
 * {@link canvasFontPath}.
 */
export const claudeDesignCanvasFiles = (input: ClaudeDesignCanvasInput): readonly AdapterFile[] => {
  const ids = input.pages.map((page, index) => pageIdOf(page.tree.page, index))
  const paths = boardPathsOf(ids)
  const heights = input.pages.map((page) => boardHeightOf(page.tree))
  const namespace = canvasNamespaceOf(input.appName)
  const index = {
    v: 3,
    createdOnFiles: { at: NO_DATE, v: 1 },
    title: `${input.appName} pages`,
    launch: { view: 'canvas', ...(ids[0] === undefined ? {} : { page: ids[0] }) },
    pages: input.pages.map((page, at) => ({ id: ids[at], name: page.tree.page })),
    boards: Object.fromEntries(
      input.pages.map((page, at) => [
        paths[at],
        {
          x: at * (BOARD_WIDTH + BOARD_GAP),
          y: 0,
          w: BOARD_WIDTH,
          h: heights[at],
          title: `${input.appName} · ${page.tree.page}`,
          page: ids[at],
          expand: 'fill',
        },
      ])
    ),
    order: paths,
    notes: {},
    designSystems: [
      // The format writes an unknown address and version as JSON null; the
      // person's own install of the published project replaces this record.
      // eslint-disable-next-line unicorn/no-null -- a JSON value the canvas format requires
      { title: input.appName, namespace, artifact: null, version: null, copiedAt: NO_DATE },
    ],
    attachments: {},
  }
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
      content: JSON.stringify(index, undefined, 1),
    },
    ...input.pages.map((page, at) => ({
      path: `${CLAUDE_DESIGN_CANVAS_DIR}/${paths[at] ?? ''}`,
      content: boardOf(input, page, heights[at] ?? MIN_BOARD),
    })),
    ...stylesheet,
    { path: `${CLAUDE_DESIGN_CANVAS_DIR}/ds/${namespace}/tokens.json`, content: input.tokens },
  ]
}
