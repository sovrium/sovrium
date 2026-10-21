/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Chunk } from 'effect'
import {
  parseHtmlElementTree,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import {
  pageDesignTreeSchema,
  pageExportStampSchema,
  type PageDesignTreeNode,
  type PageExportStamp,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  parseJson,
  type ImportSource,
} from '@/domain/models/app/design/adapters/import/canonical-tokens-service'
import {
  layoutsOfClassName,
  type SpacingScale,
} from '@/domain/models/app/pages/page-layout-service'
import { lockedDigestOf } from './claude-design-canvas-digest'
import { CANVAS_STAMP, CANVAS_STAMP_FORMAT } from './claude-design-canvas-export'
import { CANVAS_LINK_STAMP } from './claude-design-canvas-links'
import {
  addedNodeIdOf,
  type PageDrawingFinding,
  type PageDrawingParse,
  type ParsedPageDrawing,
} from './page-drawing'

/**
 * The Claude Design page adapter, parse half: a canvas project folder (its
 * `canvas.json` and the boards it indexes), or one board alone, read back into
 * the SAME design tree the bundle writes as `pages/<name>.tree.json`, plus the
 * export stamp the board carried. The page import merges that tree into the
 * config; this file decides nothing about the config.
 *
 * ─── WHAT IS READ ──────────────────────────────────────────────────────────
 *
 * Only what `claude-design-canvas-export.ts` stamps, and the order of the
 * stamped elements: `data-kit` (the type), `data-sovrium-id` (the path id),
 * `data-kit-variant` and `data-kit-size`, the node's own layout from
 * `data-kit-layout` resolved to the spacing scale, its text where
 * `data-kit-content` says it is literal copy, the text a node drawing no kit
 * component inside it shows (a translated or bound text, which the merge
 * sorts by what the config says of it), and, on top of that layout, an
 * inline `style` a designer set in the properties panel when it is a layout
 * property on the scale. A locked node's inside is never read as nodes: it is
 * read as one DIGEST — its tags, attributes and text, each slotted page node
 * standing in by its type — which the merge only ever compares with the
 * digest of an unedited export, so an edit inside a template or an island is
 * reported rather than lost.
 *
 * The page a board draws is read from its ROOT alone — the stamp it carries,
 * else the root's own page name — never from an element inside it: a link in
 * a board's navigation names the page it leads to, not the page drawn.
 *
 * Everything else is REPORTED, never approximated: a length off the scale is
 * read as drawn, which the merge reports with its nearest step; a value that
 * is no length, or a style property that is not layout, lands in `offScale`; a `data-kit` naming a
 * type the catalogue lacks, and text drawn outside any kit component, land in
 * `notAKitComponent`. A `data-kit` element with no id is a node the designer
 * added; it gets the path id `<page>:/added/<n>` (`n` in document order),
 * which no page node can carry, since every page node lives under
 * `/components`.
 *
 * ─── SAFE BY CONSTRUCTION ──────────────────────────────────────────────────
 *
 * The board is parsed with a real HTML parser into an inert tree; no script
 * runs and no script text is read. A board path from the index holding `..`,
 * `\` or a leading `/` names no file and is refused, as the canvas format
 * itself refuses it. The files are the ones the source reader already read
 * (no link followed, sizes bounded); nothing else is opened.
 */

/** A Claude Design canvas read back. */
export interface ClaudeDesignCanvasParse extends PageDrawingParse {
  readonly format: 'claude-design'
}

/** What the parse resolves values against. */
export interface ClaudeDesignCanvasParseOptions {
  /** The app's `design.spacing`, which a layout value is resolved to. */
  readonly spacing?: SpacingScale | undefined
  /** The catalogued component types; an added `data-kit` outside it is reported. Any type when absent. */
  readonly kitTypes?: ReadonlySet<string> | undefined
}

const BOARD_SUFFIX = '.dc.html'
const INDEX_NAME = 'canvas.json'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/** A canvas index, by the keys the format guarantees. */
const isCanvasIndex = (
  document: unknown
): document is { readonly boards: Record<string, unknown> } =>
  isRecord(document) && document['v'] === 3 && isRecord(document['boards'])

/** Whether a board's text is a canvas board at all: it is rooted at `<x-dc>`. */
const isBoardText = (text: string): boolean => text.includes('<x-dc')

/** Whether a source is a Claude Design canvas: a version 3 index, or a lone board. */
export const isClaudeDesignCanvas = (source: ImportSource): boolean =>
  source.files.some(
    (file) =>
      (baseName(file.path) === INDEX_NAME && isCanvasIndex(parseJson(file.text))) ||
      (source.entry !== undefined &&
        file.path === source.entry &&
        file.path.endsWith(BOARD_SUFFIX) &&
        isBoardText(file.text))
  )

/** A path the canvas format refuses: it climbs, it is absolute, or it uses `\`. */
const isUnsafeBoardPath = (path: string): boolean =>
  path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')

// ─── one element ───────────────────────────────────────────────────────────

const attribute = (element: HtmlElementNode, name: string): string | undefined =>
  element.attributes[name]

/** Whether an element is a kit component: it carries `data-kit`. */
const isKitElement = (element: HtmlElementNode): boolean =>
  attribute(element, CANVAS_STAMP.kit) !== undefined

/** An element's own text: its text runs, not those of a kit component inside it. */
const ownTextOf = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text' ? node.text : isKitElement(node) ? '' : ownTextOf(node.children)
    )
    .join('')

type Layout = NonNullable<PageDesignTreeNode['layout']>
type LayoutValue = NonNullable<Layout['gap']>

const DIRECTION_VALUES: Readonly<Record<string, string>> = {
  row: 'row',
  column: 'column',
  'row-reverse': 'row-reverse',
  'column-reverse': 'column-reverse',
}
const ALIGN_VALUES: Readonly<Record<string, string>> = {
  start: 'start',
  'flex-start': 'start',
  center: 'center',
  end: 'end',
  'flex-end': 'end',
  stretch: 'stretch',
  baseline: 'baseline',
}
const JUSTIFY_VALUES: Readonly<Record<string, string>> = {
  start: 'start',
  'flex-start': 'start',
  center: 'center',
  end: 'end',
  'flex-end': 'end',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
}

/** The keyword style properties a designer may set, the layout property each is, and its values. */
const KEYWORD_STYLES: Readonly<
  Record<string, readonly [keyof Layout, Readonly<Record<string, string>>]>
> = {
  'flex-direction': ['direction', DIRECTION_VALUES],
  'align-items': ['align', ALIGN_VALUES],
  'justify-content': ['justify', JUSTIFY_VALUES],
}

/** The length style properties a designer may set, resolved to the spacing scale. */
const LENGTH_STYLES: Readonly<Record<string, keyof Layout>> = {
  gap: 'gap',
  padding: 'padding',
  width: 'width',
}

const WIDTH_KEYWORDS: ReadonlySet<string> = new Set(['100%', '100vw', 'auto'])

/** A CSS length in rem, `px` read at the browser's 16 px root; `undefined` for anything else. */
const remOf = (length: string): number | undefined => {
  const [, amount = '', unit = ''] = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(length.trim()) ?? []
  if (amount === '') return undefined
  return unit === 'px' ? Number(amount) / 16 : Number(amount)
}

/**
 * A length on the scale: the declared step it equals (with its token), else
 * the `0.25rem` grid the utility classes are on, else nothing.
 */
const scaledLength = (length: string, spacing: SpacingScale): LayoutValue | undefined => {
  const rem = remOf(length)
  if (rem === undefined) return undefined
  const step = Object.entries(spacing).find(([, value]) => remOf(value) === rem)?.[0]
  if (step !== undefined) return { value: spacing[step] as string, token: `spacing.${step}` }
  return Number.isInteger(rem * 8) ? { value: `${rem}rem` } : undefined
}

/** One inline style declaration as a layout setting, or why it is not one. */
const styleSetting = (
  property: string,
  value: string,
  spacing: SpacingScale
): readonly [keyof Layout, LayoutValue] | string => {
  const offScale = `${property}: ${value} is off the scale`
  const keyword = KEYWORD_STYLES[property]
  if (keyword !== undefined) {
    const resolved = keyword[1][value]
    return resolved === undefined ? offScale : [keyword[0], { value: resolved }]
  }
  const length = LENGTH_STYLES[property]
  if (length === undefined) return `${property} is not a layout property the import reads`
  if (length === 'width' && WIDTH_KEYWORDS.has(value)) return ['width', { value }]
  // A length off the scale is drawn as it is: the merge reports it with its nearest step.
  if (remOf(value) === undefined) return offScale
  return [length, scaledLength(value, spacing) ?? { value }]
}

/** The `property: value` pairs of an inline style, lower-cased, in order. */
const declarationsOf = (style: string): readonly (readonly [string, string])[] =>
  style
    .split(';')
    .map((declaration) => declaration.split(':'))
    .filter((parts) => parts.length >= 2 && (parts[0] ?? '').trim() !== '')
    .map(
      (parts) => [(parts[0] ?? '').trim().toLowerCase(), parts.slice(1).join(':').trim()] as const
    )

/** A node's layout: its stamped classes, then any inline layout a designer set on top. */
const layoutOf = (
  element: HtmlElementNode,
  spacing: SpacingScale
): {
  readonly base: Layout | undefined
  readonly responsive: Readonly<Record<string, Layout>> | undefined
  readonly offScale: readonly string[]
} => {
  const stamped = layoutsOfClassName(
    { props: { className: attribute(element, CANVAS_STAMP.layout) ?? '' } },
    spacing
  )
  const settings = declarationsOf(attribute(element, 'style') ?? '').map(([property, value]) =>
    styleSetting(property, value, spacing)
  )
  const applied = settings.filter((setting): setting is readonly [keyof Layout, LayoutValue] =>
    Array.isArray(setting)
  )
  const base = applied.reduce<Layout | undefined>(
    (layout, [property, value]) => ({ ...layout, [property]: value }),
    stamped.base
  )
  return {
    base,
    responsive: stamped.responsive,
    offScale: settings.filter((setting): setting is string => typeof setting === 'string'),
  }
}

// ─── one board ─────────────────────────────────────────────────────────────

/**
 * What a walk has read so far. Its lists are chunks, which append in
 * logarithmic time: a board of many siblings is then read in time near-linear
 * in its size, where copying an array per sibling made it quadratic.
 */
interface Walk {
  readonly nodes: Chunk.Chunk<PageDesignTreeNode>
  readonly added: number
  readonly offScale: Chunk.Chunk<PageDrawingFinding>
  readonly notAKitComponent: Chunk.Chunk<PageDrawingFinding>
  /** What each locked node draws inside, as a digest, by node id. */
  readonly drawings: Chunk.Chunk<readonly [string, string]>
}

interface BoardContext {
  readonly board: string
  readonly page: string
  readonly spacing: SpacingScale
  readonly kitTypes: ReadonlySet<string> | undefined
  readonly keys: ReadonlyMap<string, string>
}

const EMPTY_WALK: Walk = {
  nodes: Chunk.empty(),
  added: 0,
  offScale: Chunk.empty(),
  notAKitComponent: Chunk.empty(),
  drawings: Chunk.empty(),
}

const merged = (left: Walk, right: Walk): Walk => ({
  nodes: Chunk.appendAll(left.nodes, right.nodes),
  added: right.added,
  offScale: Chunk.appendAll(left.offScale, right.offScale),
  notAKitComponent: Chunk.appendAll(left.notAKitComponent, right.notAKitComponent),
  drawings: Chunk.appendAll(left.drawings, right.drawings),
})

/** A walk with findings added to what it is not a kit component. */
const withStray = (walk: Walk, findings: readonly PageDrawingFinding[]): Walk => ({
  ...walk,
  notAKitComponent: Chunk.appendAll(walk.notAKitComponent, Chunk.fromIterable(findings)),
})

/** The elements a board holds that are never content. */
const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'helmet',
  'link',
  'meta',
  'template',
])

/** A path id stamped on a node of THIS page, or `undefined`. */
const stampedIdOf = (context: BoardContext, element: HtmlElementNode): string | undefined => {
  const id = attribute(element, CANVAS_STAMP.id)
  return id !== undefined && id.startsWith(`${context.page}:/`) ? id : undefined
}

/** Whether any element under some nodes is a kit component. */
const holdsKitElement = (nodes: readonly HtmlNode[]): boolean =>
  nodes.some(
    (node) =>
      node.kind === 'element' &&
      !SKIPPED_TAGS.has(node.tag) &&
      (isKitElement(node) || holdsKitElement(node.children))
  )

/**
 * The text a kit element draws as its content, never a locked node's. An
 * added node's text is its content; an exported one's is its literal copy
 * where the export said so, else — on a node drawing no kit component inside
 * it — the text it shows, translated or bound, which the merge compares with
 * an unedited export's and sorts by what the config says of the node.
 */
const contentOf = (element: HtmlElementNode, stampedId: string | undefined): string => {
  if (attribute(element, CANVAS_STAMP.locked) !== undefined) return ''
  if (stampedId === undefined) return ownTextOf(element.children).trim()
  if (attribute(element, CANVAS_STAMP.content) !== undefined) return ownTextOf(element.children)
  return holdsKitElement(element.children) ? '' : ownTextOf(element.children).trim()
}

/** A tree node's optional fields, each present only when the drawing sets it. */
const optionalFieldsOf = (
  element: HtmlElementNode,
  key: string | undefined,
  layout: ReturnType<typeof layoutOf> | undefined,
  content: string
): Partial<PageDesignTreeNode> => {
  const variant = attribute(element, CANVAS_STAMP.variant)
  const size = attribute(element, CANVAS_STAMP.size)
  const locked = attribute(element, CANVAS_STAMP.locked)
  return {
    ...(key === undefined ? {} : { key }),
    ...(variant === undefined ? {} : { variant }),
    ...(size === undefined ? {} : { size }),
    ...(layout?.base === undefined ? {} : { layout: layout.base }),
    ...(layout?.responsive === undefined ? {} : { responsive: layout.responsive }),
    ...(content === '' ? {} : { content }),
    ...(locked === undefined
      ? {}
      : { locked: locked as NonNullable<PageDesignTreeNode['locked']> }),
  }
}

/**
 * The page nodes a template placement draws in its slots: the elements inside
 * it stamped with an id of this page. What the template draws around them is
 * never stamped, and never read.
 */
const slottedNodes = (context: BoardContext, nodes: readonly HtmlNode[], added: number): Walk =>
  nodes.reduce<Walk>(
    (walk, node) => {
      if (node.kind === 'text' || SKIPPED_TAGS.has(node.tag)) return walk
      return isKitElement(node) && stampedIdOf(context, node) !== undefined
        ? merged(walk, kitNode(context, node, walk.added))
        : merged(walk, slottedNodes(context, node.children, walk.added))
    },
    { ...EMPTY_WALK, added }
  )

/**
 * One kit element as a tree node, its own kit children walked; a locked node's
 * inside is not, but for the page nodes a template placement draws in its slots.
 */
/**
 * What a kit element holds: its own kit children walked; a locked node's
 * inside only as its digest, but for the page nodes a template placement
 * draws in its slots.
 */
const innerWalkOf = (
  context: BoardContext,
  element: HtmlElementNode,
  at: { readonly id: string; readonly stampedId: string | undefined; readonly added: number }
): Walk => {
  const locked = attribute(element, CANVAS_STAMP.locked)
  if (locked === undefined) return walkNodes(context, element.children, at.added, at.id)
  const inner =
    locked === 'template'
      ? slottedNodes(context, element.children, at.added)
      : { ...EMPTY_WALK, added: at.added }
  return at.stampedId === undefined
    ? inner
    : {
        ...inner,
        drawings: Chunk.prepend(inner.drawings, [
          at.stampedId,
          lockedDigestOf(element, (inner) =>
            isKitElement(inner) && stampedIdOf(context, inner) !== undefined
              ? (attribute(inner, CANVAS_STAMP.kit) ?? '')
              : undefined
          ),
        ] as const),
      }
}

function kitNode(context: BoardContext, element: HtmlElementNode, added: number): Walk {
  const stampedId = stampedIdOf(context, element)
  const id = stampedId ?? addedNodeIdOf(context.page, added)
  const next = stampedId === undefined ? added + 1 : added
  const open = attribute(element, CANVAS_STAMP.locked) === undefined
  const inner = innerWalkOf(context, element, { id, stampedId, added: next })
  const layout = open ? layoutOf(element, context.spacing) : undefined
  const key = stampedId === undefined ? undefined : context.keys.get(stampedId)
  const node: PageDesignTreeNode = {
    id,
    type: attribute(element, CANVAS_STAMP.kit) ?? '',
    ...optionalFieldsOf(element, key, layout, contentOf(element, stampedId)),
    children: Chunk.toReadonlyArray(inner.nodes),
  }
  return {
    nodes: Chunk.of(node),
    added: inner.added,
    offScale: Chunk.prependAll(
      inner.offScale,
      Chunk.fromIterable(
        (layout?.offScale ?? []).map((detail) => ({ board: context.board, node: id, detail }))
      )
    ),
    notAKitComponent: inner.notAKitComponent,
    drawings: inner.drawings,
  }
}

/** Visible text drawn directly in an element that is no kit component. */
const looseTextOf = (element: HtmlElementNode): string =>
  element.children
    .flatMap((child) => (child.kind === 'text' ? [child.text] : []))
    .join('')
    .trim()

/**
 * The tree nodes among some sibling HTML nodes, in document order. An element
 * that is no kit component is walked through; inside a kit component its
 * text is the component's, outside any it is reported.
 */
function walkNodes(
  context: BoardContext,
  nodes: readonly HtmlNode[],
  added: number,
  inside: string | undefined
): Walk {
  return nodes.reduce<Walk>(
    (walk, node) => {
      if (node.kind === 'text' || SKIPPED_TAGS.has(node.tag)) return walk
      if (isKitElement(node)) {
        const type = attribute(node, CANVAS_STAMP.kit) ?? ''
        const known =
          context.kitTypes === undefined ||
          context.kitTypes.has(type) ||
          stampedIdOf(context, node) !== undefined
        if (known) return merged(walk, kitNode(context, node, walk.added))
        const finding = {
          board: context.board,
          node: inside,
          detail: `data-kit="${type}" is not a kit component`,
        }
        const through = walkNodes(context, node.children, walk.added, inside)
        return merged(withStray(walk, [finding]), through)
      }
      const loose = inside === undefined ? looseTextOf(node) : ''
      const findings =
        loose === ''
          ? []
          : [
              {
                board: context.board,
                detail: `<${node.tag}> draws "${loose.slice(0, 60)}" outside any kit component`,
              },
            ]
      const through = walkNodes(context, node.children, walk.added, inside)
      return merged(withStray(walk, findings), through)
    },
    { ...EMPTY_WALK, added }
  )
}

/** The first element with `tag` among some nodes, at any depth. */
const findElement = (nodes: readonly HtmlNode[], tag: string): HtmlElementNode | undefined =>
  nodes.reduce<HtmlElementNode | undefined>(
    (found, node) =>
      found ??
      (node.kind !== 'element'
        ? undefined
        : node.tag === tag
          ? node
          : findElement(node.children, tag)),
    undefined
  )

/** The stamp a board's root carries, decoded; `undefined` when it is missing or broken. */
const stampOf = (
  root: HtmlElementNode | undefined
): { readonly page: string; readonly exported: PageExportStamp } | undefined => {
  const document = parseJson(root === undefined ? '' : (attribute(root, CANVAS_STAMP.stamp) ?? ''))
  if (
    !isRecord(document) ||
    document['format'] !== CANVAS_STAMP_FORMAT ||
    typeof document['page'] !== 'string'
  ) {
    return undefined
  }
  const exported = decodeSafe(pageExportStampSchema)(document['exported'])
  return exported.success ? { page: document['page'], exported: exported.data } : undefined
}

type BoardResult =
  | { readonly ok: true; readonly drawing: ParsedPageDrawing }
  | { readonly ok: false; readonly finding: PageDrawingFinding }

const refusal = (board: string, detail: string): BoardResult => ({
  ok: false,
  finding: { board, detail },
})

/** Whether an element is a board's root: it carries the export stamp, or a page name that is no link's. */
const isBoardRoot = (element: HtmlElementNode): boolean =>
  attribute(element, CANVAS_STAMP.stamp) !== undefined ||
  (attribute(element, CANVAS_STAMP.page) !== undefined &&
    attribute(element, CANVAS_LINK_STAMP.href) === undefined)

/** A board's root, at any depth: the first element {@link isBoardRoot} holds for. */
const boardRootIn = (nodes: readonly HtmlNode[]): HtmlElementNode | undefined =>
  nodes.reduce<HtmlElementNode | undefined>(
    (found, node) =>
      found ??
      (node.kind !== 'element' || SKIPPED_TAGS.has(node.tag)
        ? undefined
        : isBoardRoot(node)
          ? node
          : boardRootIn(node.children)),
    undefined
  )

/**
 * The page a board draws, and its stamp: the root's stamp's page, else the
 * root's own page name. An element inside the root is never asked, since a
 * link in the board's navigation carries the name of the page it leads to.
 */
const boardPageOf = (
  canvas: HtmlElementNode
): {
  readonly page: string | undefined
  readonly stamp: ReturnType<typeof stampOf>
} => {
  const root = boardRootIn(canvas.children)
  const stamp = stampOf(root)
  return {
    page: stamp?.page ?? (root === undefined ? undefined : attribute(root, CANVAS_STAMP.page)),
    stamp,
  }
}

const SIZE_REFUSALS: Readonly<Record<'too-large' | 'too-deep', string>> = {
  'too-large': 'the board is too large to read',
  'too-deep': 'the board is nested too deep to read',
}

/** One board read back into its page's design tree. */
const parseBoard = (
  board: string,
  text: string,
  options: ClaudeDesignCanvasParseOptions
): BoardResult => {
  const parsed = parseHtmlElementTree(text)
  if (!parsed.ok) return refusal(board, SIZE_REFUSALS[parsed.reason])
  const canvas = findElement(parsed.nodes, 'x-dc')
  if (canvas === undefined) return refusal(board, 'the board holds no <x-dc> drawing')
  const { page, stamp } = boardPageOf(canvas)
  if (page === undefined) {
    return refusal(board, 'the board draws no Sovrium page: it carries no page name')
  }
  const context: BoardContext = {
    board,
    page,
    spacing: options.spacing ?? {},
    kitTypes: options.kitTypes,
    keys: new Map(
      (stamp?.exported ?? []).flatMap((entry) =>
        entry.key === undefined ? [] : [[entry.id, entry.key] as const]
      )
    ),
  }
  const walk = walkNodes(context, canvas.children, 0, undefined)
  const tree = decodeSafe(pageDesignTreeSchema)({
    format: 'sovrium.design-system.page-tree',
    version: 1,
    page,
    nodes: Chunk.toReadonlyArray(walk.nodes),
  })
  if (!tree.success) return refusal(board, `the board's nodes do not form a page tree of ${page}`)
  return {
    ok: true,
    drawing: {
      board,
      tree: tree.data,
      exported: stamp?.exported ?? [],
      stamped: stamp !== undefined,
      offScale: Chunk.toReadonlyArray(walk.offScale),
      notAKitComponent: Chunk.toReadonlyArray(walk.notAKitComponent),
      drawings: Object.fromEntries(Chunk.toReadonlyArray(walk.drawings)),
    },
  }
}

// ─── a source ──────────────────────────────────────────────────────────────

/** The boards a source names: every board of every index it holds, or the lone board given. */
const boardsOf = (
  source: ImportSource
): readonly { readonly board: string; readonly path: string | undefined }[] => {
  const indexes = source.files.filter(
    (file) => baseName(file.path) === INDEX_NAME && isCanvasIndex(parseJson(file.text))
  )
  if (indexes.length === 0) {
    return source.entry !== undefined && source.entry.endsWith(BOARD_SUFFIX)
      ? [{ board: source.entry, path: source.entry }]
      : []
  }
  return indexes.flatMap((file) => {
    const index = parseJson(file.text) as {
      readonly boards: Record<string, unknown>
      readonly order?: unknown
    }
    const folder = folderOf(file.path)
    const order = Array.isArray(index.order)
      ? index.order.filter((entry): entry is string => typeof entry === 'string')
      : []
    const names = [
      ...new Set([...order.filter((name) => name in index.boards), ...Object.keys(index.boards)]),
    ]
    return names.map((name) => ({
      board: name,
      path: isUnsafeBoardPath(name) ? undefined : folder === '' ? name : `${folder}/${name}`,
    }))
  })
}

/**
 * Read a Claude Design canvas back into one design tree per page it draws.
 *
 * A board that draws no Sovrium page (a designer's own sketch) is refused by
 * name and the rest are read; two boards drawing one page are both refused,
 * since nothing says which one is the design.
 */
export const fromClaudeDesignCanvas = (
  source: ImportSource,
  options: ClaudeDesignCanvasParseOptions = {}
): ClaudeDesignCanvasParse => {
  const results = boardsOf(source).map(({ board, path }): BoardResult => {
    if (path === undefined)
      return refusal(board, 'the board path climbs out of the canvas, so it names no file')
    const file = source.files.find((candidate) => candidate.path === path)
    if (file === undefined)
      return refusal(board, 'the canvas lists the board, but the export holds no such file')
    return parseBoard(board, file.text, options)
  })
  const drawings = results.flatMap((result) => (result.ok ? [result.drawing] : []))
  const twice = new Set(
    drawings
      .map((drawing) => drawing.tree.page)
      .filter((page, index, pages) => pages.indexOf(page) !== index)
  )
  return {
    format: 'claude-design',
    pages: drawings.filter((drawing) => !twice.has(drawing.tree.page)),
    refused: [
      ...results.flatMap((result) => (result.ok ? [] : [result.finding])),
      ...drawings
        .filter((drawing) => twice.has(drawing.tree.page))
        .map((drawing) => ({
          board: drawing.board,
          detail: `the page ${drawing.tree.page} is drawn on more than one board; keep one`,
        })),
    ],
  }
}
