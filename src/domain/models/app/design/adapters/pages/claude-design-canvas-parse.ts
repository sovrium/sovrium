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
import { type SpacingScale } from '@/domain/models/app/pages/page-layout-service'
import { PROTOTYPE_BOARD_ATTRIBUTE } from './claude-design-canvas-app'
import { mergedStateBoards } from './claude-design-canvas-boards'
import { lockedDigestOf } from './claude-design-canvas-digest'
import { CANVAS_STAMP, CANVAS_STAMP_FILE, CANVAS_STAMP_FORMAT } from './claude-design-canvas-export'
import { CANVAS_LINK_STAMP } from './claude-design-canvas-links'
import { drawnRulesOf } from './claude-design-canvas-rules'
import {
  canvasLayoutOf,
  shownText,
  shownTextOf,
  textWrappersOf,
  withWrappedPaint,
  type CanvasLayoutConflict,
  type CanvasNodeLayout,
  type CanvasPaint,
} from './claude-design-canvas-style'
import {
  addedNodeIdOf,
  type PageDrawingFinding,
  type PageDrawingParse,
  type ParsedPageDrawing,
} from './page-drawing'
import type { DrawnRules } from '@/domain/models/app/pages/page-drawing'

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
  /** Every layout property a node set in two places with two values, by node id. */
  readonly conflicts: Chunk.Chunk<readonly [string, CanvasLayoutConflict]>
  /** The colours and text size each node was drawn with, by node id. */
  readonly paints: Chunk.Chunk<readonly [string, CanvasPaint]>
  /** What each node the export drew does, as the board carries it, by node id. */
  readonly rules: Chunk.Chunk<readonly [string, DrawnRules]>
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
  conflicts: Chunk.empty(),
  paints: Chunk.empty(),
  rules: Chunk.empty(),
}

const merged = (left: Walk, right: Walk): Walk => ({
  nodes: Chunk.appendAll(left.nodes, right.nodes),
  added: right.added,
  offScale: Chunk.appendAll(left.offScale, right.offScale),
  notAKitComponent: Chunk.appendAll(left.notAKitComponent, right.notAKitComponent),
  drawings: Chunk.appendAll(left.drawings, right.drawings),
  conflicts: Chunk.appendAll(left.conflicts, right.conflicts),
  paints: Chunk.appendAll(left.paints, right.paints),
  rules: Chunk.appendAll(left.rules, right.rules),
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
  const literal = stampedId !== undefined && attribute(element, CANVAS_STAMP.content) !== undefined
  const shown = () => shownTextOf(element, ownTextOf(element.children), isKitElement, literal)
  if (stampedId === undefined || literal) return shown()
  return holdsKitElement(element.children) ? '' : shown()
}

/**
 * A mounted component's prop, which is what the canvas lets a designer change,
 * else the stamp a board drew the node with.
 */
const propOrStamp = (element: HtmlElementNode, prop: string, stamp: string): string | undefined =>
  (element.tag === 'x-import' ? attribute(element, prop) : undefined) ?? attribute(element, stamp)

/** A tree node's optional fields, each present only when the drawing sets it. */
const optionalFieldsOf = (
  element: HtmlElementNode,
  key: string | undefined,
  layout: CanvasNodeLayout | undefined,
  content: string
): Partial<PageDesignTreeNode> => {
  const variant = propOrStamp(element, 'variant', CANVAS_STAMP.variant)
  const size = propOrStamp(element, 'size', CANVAS_STAMP.size)
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

/** A locked node's layout: none is read. */
const UNREAD_LAYOUT: CanvasNodeLayout = {
  base: undefined,
  responsive: undefined,
  offScale: [],
  unread: [],
  conflicts: [],
  paint: undefined,
}

/**
 * What a node the export drew says beyond its tree node: every class it holds
 * that the import does not read, every element wrapping its text (no kit
 * component, named), every layout property set twice, and its paint.
 */
const stampedExtrasOf = (
  context: BoardContext,
  element: HtmlElementNode,
  at: { readonly id: string; readonly layout: CanvasNodeLayout | undefined }
): Pick<Walk, 'offScale' | 'notAKitComponent' | 'conflicts' | 'paints'> => {
  const { id } = at
  const layout = at.layout ?? UNREAD_LAYOUT
  // Only a node drawing its own copy is read for wrappers: a component drawing
  // records (a seed's values) wraps them in its own markup.
  const copy =
    attribute(element, CANVAS_STAMP.content) !== undefined ||
    attribute(element, CANVAS_STAMP.kit) === 'text'
  const wrappers =
    at.layout === undefined || !copy
      ? []
      : textWrappersOf(element.children, isKitElement, (inner) => SKIPPED_TAGS.has(inner.tag))
  const finding = (detail: string): PageDrawingFinding => ({
    board: context.board,
    node: id,
    detail,
  })
  const paint = withWrappedPaint(layout.paint, wrappers)
  return {
    offScale: Chunk.fromIterable([
      ...layout.offScale.map(finding),
      ...layout.unread.map((token) => finding(`the class ${token} is not one the import reads`)),
    ]),
    notAKitComponent: Chunk.fromIterable(
      wrappers.map((wrapper) =>
        finding(
          `<${wrapper.tag}> wraps text inside this node and is no kit component, so it was not imported; style the node with a token instead`
        )
      )
    ),
    conflicts: Chunk.fromIterable(layout.conflicts.map((conflict) => [id, conflict] as const)),
    paints: paint === undefined ? Chunk.empty() : Chunk.of([id, paint] as const),
  }
}

/**
 * What a kit element says of itself: its layout when it is open, and its
 * rules, on a node the export drew as on one the designer added, which the
 * merge writes on the new node.
 */
const ownReadOf = (
  context: BoardContext,
  element: HtmlElementNode,
  stampedId: string | undefined
): { readonly layout: CanvasNodeLayout | undefined; readonly rules: DrawnRules | undefined } => ({
  layout:
    attribute(element, CANVAS_STAMP.locked) === undefined
      ? canvasLayoutOf(element, stampedId !== undefined, {
          layoutAttribute: CANVAS_STAMP.layout,
          spacing: context.spacing,
        })
      : undefined,
  rules: drawnRulesOf(element.attributes, attribute(element, CANVAS_STAMP.kit) ?? ''),
})

function kitNode(context: BoardContext, element: HtmlElementNode, added: number): Walk {
  const stampedId = stampedIdOf(context, element)
  const id = stampedId ?? addedNodeIdOf(context.page, added)
  const next = stampedId === undefined ? added + 1 : added
  const inner = innerWalkOf(context, element, { id, stampedId, added: next })
  const { layout, rules } = ownReadOf(context, element, stampedId)
  const key = stampedId === undefined ? undefined : context.keys.get(stampedId)
  const node: PageDesignTreeNode = {
    id,
    type: attribute(element, CANVAS_STAMP.kit) ?? '',
    ...optionalFieldsOf(element, key, layout, contentOf(element, stampedId)),
    children: Chunk.toReadonlyArray(inner.nodes),
  }
  const extras =
    stampedId === undefined
      ? {
          ...EMPTY_WALK,
          offScale: Chunk.fromIterable(
            (layout?.offScale ?? []).map((detail) => ({ board: context.board, node: id, detail }))
          ),
        }
      : stampedExtrasOf(context, element, { id, layout })
  return {
    nodes: Chunk.of(node),
    added: inner.added,
    offScale: Chunk.appendAll(extras.offScale, inner.offScale),
    notAKitComponent: Chunk.appendAll(extras.notAKitComponent, inner.notAKitComponent),
    drawings: inner.drawings,
    conflicts: Chunk.appendAll(extras.conflicts, inner.conflicts),
    paints: Chunk.appendAll(extras.paints, inner.paints),
    rules: rules === undefined ? inner.rules : Chunk.prepend(inner.rules, [id, rules] as const),
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

/** One board's export stamp: the page it draws and every node it draws. */
type BoardStamp = {
  readonly page: string
  readonly exported: PageExportStamp
  /** The text the export drew on each node whose text the config does not keep literally. */
  readonly texts?: Readonly<Record<string, string>> | undefined
}

/** A stamp document decoded; `undefined` when it is not one. */
const stampDocumentOf = (document: unknown): BoardStamp | undefined => {
  if (
    !isRecord(document) ||
    document['format'] !== CANVAS_STAMP_FORMAT ||
    typeof document['page'] !== 'string'
  ) {
    return undefined
  }
  const exported = decodeSafe(pageExportStampSchema)(document['exported'])
  const texts = isRecord(document['texts'])
    ? Object.fromEntries(
        Object.entries(document['texts']).flatMap(([id, text]) =>
          typeof text === 'string' ? [[id, text] as const] : []
        )
      )
    : undefined
  return exported.success
    ? { page: document['page'], exported: exported.data, ...(texts === undefined ? {} : { texts }) }
    : undefined
}

/** The stamp a board's root carries, decoded; `undefined` when it is missing or broken. */
const stampOf = (root: HtmlElementNode | undefined): BoardStamp | undefined =>
  stampDocumentOf(parseJson(root === undefined ? '' : (attribute(root, CANVAS_STAMP.stamp) ?? '')))

/**
 * Each board's stamp, by board file, from the canvas's stamp file beside its
 * index; none when the canvas carries no such file.
 */
const stampFileOf = (source: ImportSource, folder: string): ReadonlyMap<string, BoardStamp> => {
  const path = folder === '' ? CANVAS_STAMP_FILE : `${folder}/${CANVAS_STAMP_FILE}`
  const document = parseJson(source.files.find((file) => file.path === path)?.text ?? '')
  const boards = isRecord(document) && isRecord(document['boards']) ? document['boards'] : {}
  return new Map(
    Object.entries(boards).flatMap(([board, entry]) => {
      const stamp = isRecord(entry)
        ? stampDocumentOf({ format: CANVAS_STAMP_FORMAT, ...entry })
        : undefined
      return stamp === undefined ? [] : [[board, stamp] as const]
    })
  )
}

type BoardResult =
  | { readonly ok: true; readonly drawing: ParsedPageDrawing; readonly state?: string | undefined }
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
  canvas: HtmlElementNode,
  filed: BoardStamp | undefined
): {
  readonly page: string | undefined
  readonly stamp: ReturnType<typeof stampOf>
  readonly state: string | undefined
  readonly declares: ParsedPageDrawing['declares']
} => {
  const root = boardRootIn(canvas.children)
  const stamp = filed ?? stampOf(root)
  const own = root?.attributes ?? {}
  return {
    page: stamp?.page ?? own[CANVAS_STAMP.page],
    stamp,
    state: own[CANVAS_STAMP.state],
    declares: declaresOf(own),
  }
}

/** What a board's root says of a page the config may not declare, when it says anything. */
const declaresOf = (own: Readonly<Record<string, string>>): ParsedPageDrawing['declares'] => {
  const path = own[NEW_PAGE_ATTRIBUTES.path]
  const like = own[NEW_PAGE_ATTRIBUTES.like]
  if (path === undefined && like === undefined) return undefined
  return { ...(path === undefined ? {} : { path }), ...(like === undefined ? {} : { like }) }
}

/** What a board's root may say of the page it draws, when the config does not declare it yet. */
const NEW_PAGE_ATTRIBUTES = { path: 'data-sovrium-path', like: 'data-sovrium-like' } as const

const SIZE_REFUSALS: Readonly<Record<'too-large' | 'too-deep', string>> = {
  'too-large': 'the board is too large to read',
  'too-deep': 'the board is nested too deep to read',
}

/**
 * A board's nodes, each text the export drew where the config keeps none (a
 * seeded record's value, a role's name) left unread when it is still the text
 * drawn: it is no edit, whatever an unedited export draws there today.
 */
const withoutDrawnTexts = (
  nodes: readonly PageDesignTreeNode[],
  texts: Readonly<Record<string, string>>
): readonly PageDesignTreeNode[] =>
  nodes.map(({ content, ...node }) => ({
    ...node,
    ...(content === undefined ||
    (texts[node.id] !== undefined && shownText(texts[node.id] ?? '') === shownText(content))
      ? {}
      : { content }),
    children: withoutDrawnTexts(node.children, texts),
  }))

/** What one board's nodes are read against: its page, the scale, and the keys its stamp names. */
const boardContextOf = (
  board: string,
  page: string,
  options: ClaudeDesignCanvasParseOptions,
  stamp: BoardStamp | undefined
): BoardContext => ({
  board,
  page,
  spacing: options.spacing ?? {},
  kitTypes: options.kitTypes,
  keys: new Map(
    (stamp?.exported ?? []).flatMap((entry) =>
      entry.key === undefined ? [] : [[entry.id, entry.key] as const]
    )
  ),
})

/** One board read back into its page's design tree. */
const parseBoard = (
  board: string,
  text: string,
  options: ClaudeDesignCanvasParseOptions,
  filed?: BoardStamp
): BoardResult => {
  const parsed = parseHtmlElementTree(text)
  if (!parsed.ok) return refusal(board, SIZE_REFUSALS[parsed.reason])
  const canvas = findElement(parsed.nodes, 'x-dc')
  if (canvas === undefined) return refusal(board, 'the board holds no <x-dc> drawing')
  const { page, stamp, state, declares } = boardPageOf(canvas, filed)
  if (page === undefined) {
    return refusal(board, 'the board draws no Sovrium page: it carries no page name')
  }
  const walk = walkNodes(boardContextOf(board, page, options, stamp), canvas.children, 0, undefined)
  const tree = decodeSafe(pageDesignTreeSchema)({
    format: 'sovrium.design-system.page-tree',
    version: 1,
    page,
    nodes: Chunk.toReadonlyArray(walk.nodes),
  })
  if (!tree.success) return refusal(board, `the board's nodes do not form a page tree of ${page}`)
  const nodes = withoutDrawnTexts(tree.data.nodes, stamp?.texts ?? {})
  return {
    ok: true,
    state,
    drawing: {
      board,
      tree: { ...tree.data, nodes },
      exported: stamp?.exported ?? [],
      stamped: stamp !== undefined,
      offScale: Chunk.toReadonlyArray(walk.offScale),
      notAKitComponent: Chunk.toReadonlyArray(walk.notAKitComponent),
      drawings: Object.fromEntries(Chunk.toReadonlyArray(walk.drawings)),
      conflicts: Chunk.toReadonlyArray(walk.conflicts).map(([node, conflict]) => ({
        node,
        ...conflict,
      })),
      paints: Object.fromEntries(Chunk.toReadonlyArray(walk.paints)),
      rules: Object.fromEntries(Chunk.toReadonlyArray(walk.rules)),
      ...(declares === undefined ? {} : { declares }),
    },
  }
}

// ─── a source ──────────────────────────────────────────────────────────────

/** The boards a source names: every board of every index it holds, or the lone board given. */
const boardsOf = (
  source: ImportSource
): readonly {
  readonly board: string
  readonly path: string | undefined
  readonly stamp?: BoardStamp | undefined
}[] => {
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
    const stamps = stampFileOf(source, folder)
    const order = Array.isArray(index.order)
      ? index.order.filter((entry): entry is string => typeof entry === 'string')
      : []
    const names = [
      ...new Set([...order.filter((name) => name in index.boards), ...Object.keys(index.boards)]),
    ]
    return names.map((name) => ({
      board: name,
      path: isUnsafeBoardPath(name) ? undefined : folder === '' ? name : `${folder}/${name}`,
      stamp: stamps.get(name),
    }))
  })
}

/**
 * Read a Claude Design canvas back into one design tree per page it draws.
 *
 * A board that draws no Sovrium page (a designer's own sketch) is refused by
 * name and the rest are read. A page's state boards are read as that page
 * (`claude-design-canvas-boards.ts`); two default boards drawing one page are
 * both refused, since nothing says which one is the design.
 */
export const fromClaudeDesignCanvas = (
  source: ImportSource,
  options: ClaudeDesignCanvasParseOptions = {}
): ClaudeDesignCanvasParse => {
  const results = boardsOf(source).flatMap(({ board, path, stamp }): readonly BoardResult[] => {
    if (path === undefined)
      return [refusal(board, 'the board path climbs out of the canvas, so it names no file')]
    const file = source.files.find((candidate) => candidate.path === path)
    if (file === undefined)
      return [refusal(board, 'the canvas lists the board, but the export holds no such file')]
    // The Prototype board plays the pages; it is none of them, and nothing on it is read.
    if (file.text.includes(` ${PROTOTYPE_BOARD_ATTRIBUTE}=`)) return []
    return [parseBoard(board, file.text, options, stamp)]
  })
  const read = mergedStateBoards(
    results.flatMap((result) =>
      result.ok ? [{ drawing: result.drawing, state: result.state }] : []
    )
  )
  return {
    format: 'claude-design',
    pages: read.pages,
    refused: [...results.flatMap((result) => (result.ok ? [] : [result.finding])), ...read.refused],
  }
}
