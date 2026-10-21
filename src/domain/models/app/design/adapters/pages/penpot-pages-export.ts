/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The export half of the Penpot page adapter: an app's pages drawn as one
 * Penpot file, `adapters/penpot/<app>.penpot`, which Penpot imports as it is.
 *
 * ─── THE SAME LAYERS AS THE FIGMA PAGE DOCUMENT ────────────────────────────
 *
 * What each node draws (a text, a kit component and its label, a locked
 * template placement with its text, a locked island with its seeded rows) is
 * the base board of the page's Figma page document (`figma-pages-export.ts`),
 * so the two tools draw a page alike. Each layer becomes a Penpot shape: a
 * text layer a `text` shape, any other a `frame`. A page is drawn once, at the
 * base width: Penpot has no breakpoints, so a layout set at a breakpoint stays
 * in the config, untouched by a Penpot round trip.
 *
 * ─── LAYOUT ON THE TOKEN SCALE ─────────────────────────────────────────────
 *
 * A container's flex layout is written from its node's own base layout: the
 * direction, alignment and distribution as the tree names them, which are
 * Penpot's own words, and the gap and padding in px at a 16px root.
 *
 * ─── EACH PAGE ON ONE BOARD ────────────────────────────────────────────────
 *
 * Every Penpot page holds one board named after the page, under its root
 * frame. The board carries the page's name and its export stamp as plugin
 * data; every shape drawn from a node carries `{id, type}`, plus its variant
 * and size, or a placement's variables, and why it is locked. A shape drawn
 * inside a node carries none. Nothing else of the config is written: no
 * binding, data source, visibility rule, translation key, interaction, path
 * or meta.
 *
 * Every id is derived from the app, the page and the shape's position, and
 * every entry is written in path order, so two exports of one config are the
 * same bytes.
 */

import { cssLengthInPx } from './figma-pages-layout'
import {
  PENPOT_ALIGN_ITEMS,
  PENPOT_DATA_VERSION,
  PENPOT_EXPORT_TYPE,
  PENPOT_FILE_FEATURES,
  PENPOT_FLEX_DIRECTIONS,
  PENPOT_JUSTIFY_CONTENT,
  PENPOT_MANIFEST_PATH,
  PENPOT_PLUGIN_NAMESPACE,
  PENPOT_ROOT_FRAME_ID,
  penpotUuidOf,
} from './penpot-pages-format'
import type {
  FigmaPageDocument,
  FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** One page of the file: its Figma page document, of which the base board is drawn, and its tree. */
export interface PenpotPageInput {
  readonly document: FigmaPageDocument
  readonly nodes: readonly PageDesignTreeNode[]
}

/** What the Penpot file is drawn from. */
export interface PenpotExportInput {
  /** The app name, which names the Penpot file. */
  readonly app: string
  readonly pages: readonly PenpotPageInput[]
}

/** One entry of the archive, as JSON text. */
export interface PenpotArchiveEntry {
  readonly path: string
  readonly text: string
}

type Json = Readonly<Record<string, unknown>>

/** The width every board is drawn at, the Figma base board's. */
const BOARD_FALLBACK_WIDTH = 375
const TEXT_LINE_HEIGHT = 24
const INSTANCE_HEIGHT = 40

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** A box in absolute coordinates, as every Penpot shape states its own. */
interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const geometryOf = ({ x, y, width, height }: Box): Json => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  selrect: { x, y, width, height, x1: x, y1: y, x2: x + width, y2: y + height },
  points: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
  transform: IDENTITY,
  transformInverse: IDENTITY,
})

/** A node's flex layout, Penpot's fields, from its base layout. */
interface FlexLayout {
  readonly direction?: string | undefined
  readonly gap?: number | undefined
  readonly padding?: number | undefined
  readonly align?: string | undefined
  readonly justify?: string | undefined
}

const pxOf = (value: { readonly value: string } | undefined): number | undefined =>
  value === undefined ? undefined : cssLengthInPx(value.value)

const within = (value: string | undefined, allowed: ReadonlySet<string>): string | undefined =>
  value !== undefined && allowed.has(value) ? value : undefined

/** The flex layout a node draws, `undefined` when it sets none Penpot can draw. */
const flexLayoutOf = (node: PageDesignTreeNode | undefined): FlexLayout | undefined => {
  const layout = node?.layout
  if (layout === undefined) return undefined
  const flex: FlexLayout = {
    direction: within(layout.direction?.value, PENPOT_FLEX_DIRECTIONS),
    gap: pxOf(layout.gap),
    padding: pxOf(layout.padding),
    align: within(layout.align?.value, PENPOT_ALIGN_ITEMS),
    justify: within(layout.justify?.value, PENPOT_JUSTIFY_CONTENT),
  }
  return Object.values(flex).some((value) => value !== undefined) ? flex : undefined
}

/** A flex layout as Penpot's shape fields. */
const flexFieldsOf = (flex: FlexLayout | undefined): Json => {
  if (flex === undefined) return {}
  return {
    layout: 'flex',
    ...(flex.direction === undefined ? {} : { layoutFlexDir: flex.direction }),
    ...(flex.gap === undefined
      ? {}
      : { layoutGapType: 'simple', layoutGap: { rowGap: flex.gap, columnGap: flex.gap } }),
    ...(flex.padding === undefined
      ? {}
      : {
          layoutPaddingType: 'simple',
          layoutPadding: { p1: flex.padding, p2: flex.padding, p3: flex.padding, p4: flex.padding },
        }),
    layoutWrapType: 'nowrap',
    ...(flex.align === undefined ? {} : { layoutAlignItems: flex.align }),
    ...(flex.justify === undefined ? {} : { layoutJustifyContent: flex.justify }),
  }
}

/** The plugin data of a layer drawn from a node, every value a string. */
const tagOf = (layer: FigmaPageNode, node: PageDesignTreeNode | undefined): Json => {
  if (layer.sovrium === undefined) return {}
  const lock = node?.locked
  const properties = layer.componentProperties ?? {}
  const own =
    lock === 'template'
      ? { vars: JSON.stringify(properties) }
      : {
          ...(properties['variant'] === undefined ? {} : { variant: properties['variant'] }),
          ...(properties['size'] === undefined ? {} : { size: properties['size'] }),
        }
  return {
    pluginData: {
      [PENPOT_PLUGIN_NAMESPACE]: {
        ...(layer.sovrium.id === undefined ? {} : { id: layer.sovrium.id }),
        type: layer.sovrium.type,
        ...(lock === undefined ? {} : { lock }),
        ...own,
      },
    },
  }
}

/** Penpot's text content: one paragraph per line of the layer's characters. */
const textContentOf = (characters: string): Json => ({
  type: 'root',
  children: [
    {
      type: 'paragraph-set',
      children: characters.split('\n').map((line) => ({
        type: 'paragraph',
        children: [
          { text: line, fontSize: '16', fills: [{ fillColor: '#000000', fillOpacity: 1 }] },
        ],
      })),
    },
  ],
})

/** What every shape of one page is drawn against. */
interface PageContext {
  readonly app: string
  readonly page: string
  readonly pageId: string
  readonly nodes: ReadonlyMap<string, PageDesignTreeNode>
}

/** Where a layer is drawn: its parent frame, its box's origin and width, and its position. */
interface Slot {
  readonly parent: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly position: string
  /** The parent's flex direction, when the parent is a flex frame. */
  readonly flow?: 'row' | 'column' | undefined
}

/** One drawn layer: its shapes, its own first, and the height it took. */
interface Drawn {
  readonly id: string
  readonly shapes: readonly Json[]
  readonly height: number
}

const shapeIdOf = (context: PageContext, position: string): string =>
  penpotUuidOf(`${context.app}:shape:${context.page}:${position}`)

/** The sizing a child of a flex frame takes, so Penpot lays it out on open. */
const itemSizingOf = (slot: Slot): Json =>
  slot.flow === undefined ? {} : { layoutItemHSizing: 'fill', layoutItemVSizing: 'auto' }

/** What every shape states of itself: its id, name and type, its box, its parent and its page. */
interface ShapeHead {
  readonly id: string
  readonly name: string
  readonly type: 'frame' | 'text'
  readonly box: Box
  readonly parent: string
  readonly page: string
}

/** The fields every shape opens with. */
const baseShape = ({ id, name, type, box, parent, page }: ShapeHead): Json => ({
  id,
  name,
  type,
  ...geometryOf(box),
  parentId: parent,
  frameId: parent,
  pageId: page,
  fills: [],
  strokes: [],
})

const textShape = (layer: FigmaPageNode, slot: Slot, context: PageContext): Drawn => {
  const id = shapeIdOf(context, slot.position)
  const characters = layer.characters ?? ''
  const height = TEXT_LINE_HEIGHT * Math.max(1, characters.split('\n').length)
  const box = { x: slot.x, y: slot.y, width: slot.width, height }
  const node = nodeOfLayer(layer, context)
  return {
    id,
    height,
    shapes: [
      {
        ...baseShape({
          id,
          name: layer.name,
          type: 'text',
          box,
          parent: slot.parent,
          page: context.pageId,
        }),
        growType: 'auto-height',
        content: textContentOf(characters),
        ...itemSizingOf(slot),
        ...tagOf(layer, node),
      },
    ],
  }
}

/** How a frame lays out its children: its padding and gap in px, and along which axis. */
const flowOf = (flex: FlexLayout | undefined) => {
  const row = flex?.direction?.startsWith('row') === true
  const flow: Slot['flow'] = flex === undefined ? undefined : row ? 'row' : 'column'
  return { padding: flex?.padding ?? 0, gap: flex?.gap ?? 0, row, flow }
}

/** The tree node a layer was drawn from, when it was drawn from one. */
const nodeOfLayer = (layer: FigmaPageNode, context: PageContext): PageDesignTreeNode | undefined =>
  layer.sovrium?.id === undefined ? undefined : context.nodes.get(layer.sovrium.id)

/** The flex layout a frame draws: its own node's, never a locked node's or an untagged layer's. */
const frameFlexOf = (
  layer: FigmaPageNode,
  node: PageDesignTreeNode | undefined
): FlexLayout | undefined =>
  layer.sovrium === undefined || node?.locked !== undefined ? undefined : flexLayoutOf(node)

/** The children of a frame, laid out along its flex direction, top to bottom otherwise. */
const childrenOf = (
  layers: readonly FigmaPageNode[],
  frame: { readonly id: string; readonly box: Omit<Box, 'height'>; readonly position: string },
  flex: FlexLayout | undefined,
  context: PageContext
): { readonly drawn: readonly Drawn[]; readonly height: number } => {
  const { padding, gap, row, flow } = flowOf(flex)
  const inner = Math.max(1, frame.box.width - 2 * padding)
  const count = Math.max(1, layers.length)
  const share = row ? Math.max(1, (inner - gap * (count - 1)) / count) : inner
  const laid = layers.reduce<{ readonly drawn: readonly Drawn[]; readonly offset: number }>(
    (acc, layer, index) => {
      const slot: Slot = {
        parent: frame.id,
        x: frame.box.x + padding + (row ? acc.offset : 0),
        y: frame.box.y + padding + (row ? 0 : acc.offset),
        width: share,
        position: `${frame.position}/${index}`,
        flow,
      }
      const drawn = drawLayer(layer, slot, context)
      return {
        drawn: [...acc.drawn, drawn],
        offset: acc.offset + (row ? share : drawn.height) + gap,
      }
    },
    { drawn: [], offset: 0 }
  )
  const heights = laid.drawn.map((drawn) => drawn.height)
  const content = row
    ? Math.max(0, ...heights)
    : heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, heights.length - 1)
  return { drawn: laid.drawn, height: content + 2 * padding }
}

const frameShape = (layer: FigmaPageNode, slot: Slot, context: PageContext): Drawn => {
  const id = shapeIdOf(context, slot.position)
  const node = nodeOfLayer(layer, context)
  const flex = frameFlexOf(layer, node)
  const width = pxOf(node?.layout?.width) ?? slot.width
  const children = childrenOf(
    layer.children,
    { id, box: { x: slot.x, y: slot.y, width }, position: slot.position },
    flex,
    context
  )
  const height = layer.children.length === 0 ? INSTANCE_HEIGHT : children.height
  const box = { x: slot.x, y: slot.y, width, height }
  return {
    id,
    height,
    shapes: [
      {
        ...baseShape({
          id,
          name: layer.name,
          type: 'frame',
          box,
          parent: slot.parent,
          page: context.pageId,
        }),
        // Penpot lists a frame's children from the last in flow to the first.
        shapes: children.drawn.map((drawn) => drawn.id).toReversed(),
        ...flexFieldsOf(flex),
        ...itemSizingOf(slot),
        ...(node?.locked === undefined ? {} : { blocked: true }),
        ...tagOf(layer, node),
      },
      ...children.drawn.flatMap((drawn) => drawn.shapes),
    ],
  }
}

/** One layer and everything drawn inside it. */
function drawLayer(layer: FigmaPageNode, slot: Slot, context: PageContext): Drawn {
  return layer.nodeType === 'TEXT'
    ? textShape(layer, slot, context)
    : frameShape(layer, slot, context)
}

/** Every tree node, depth first. */
const flatten = (nodes: readonly PageDesignTreeNode[]): readonly PageDesignTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)])

const serialise = (value: unknown): string => `${JSON.stringify(value, undefined, 2)}\n`

/** One page's entries: its record, its root frame, its board and every shape on it. */
const pageEntries = (
  input: PenpotExportInput,
  page: PenpotPageInput,
  index: number,
  fileId: string
): readonly PenpotArchiveEntry[] => {
  const name = page.document.page
  const pageId = penpotUuidOf(`${input.app}:page:${name}`)
  const context: PageContext = {
    app: input.app,
    page: name,
    pageId,
    nodes: new Map(flatten(page.nodes).map((node) => [node.id, node])),
  }
  const base = page.document.boards.find((board) => board.breakpoint === 'base')
  const width = base?.width ?? BOARD_FALLBACK_WIDTH
  const boardId = shapeIdOf(context, 'board')
  const board = childrenOf(
    base?.nodes ?? [],
    { id: boardId, box: { x: 0, y: 0, width }, position: 'board' },
    { direction: 'column' },
    context
  )
  const white = [{ fillColor: '#FFFFFF', fillOpacity: 1 }]
  const root = {
    ...baseShape({
      id: PENPOT_ROOT_FRAME_ID,
      name: 'Root Frame',
      type: 'frame',
      box: { x: 0, y: 0, width: 0.01, height: 0.01 },
      parent: PENPOT_ROOT_FRAME_ID,
      page: pageId,
    }),
    fills: white,
    shapes: [boardId],
  }
  const boardShape = {
    ...baseShape({
      id: boardId,
      name,
      type: 'frame',
      box: { x: 0, y: 0, width, height: board.height },
      parent: PENPOT_ROOT_FRAME_ID,
      page: pageId,
    }),
    fills: white,
    shapes: board.drawn.map((drawn) => drawn.id).toReversed(),
    layout: 'flex',
    layoutFlexDir: 'column',
    layoutWrapType: 'nowrap',
    pluginData: {
      [PENPOT_PLUGIN_NAMESPACE]: { page: name, stamp: JSON.stringify(page.document.exported) },
    },
  }
  const folder = `files/${fileId}/pages/${pageId}`
  const shapes: readonly Json[] = [
    root,
    boardShape,
    ...board.drawn.flatMap((drawn) => drawn.shapes),
  ]
  return [
    { path: `${folder}.json`, text: serialise({ id: pageId, name, index, options: {} }) },
    ...shapes.map((shape) => ({
      path: `${folder}/${String(shape['id'])}.json`,
      text: serialise(shape),
    })),
  ]
}

/**
 * The entries of an app's Penpot file, in path order: the manifest, the file
 * record, and per page its record and every shape.
 */
export const exportPenpotFile = (input: PenpotExportInput): readonly PenpotArchiveEntry[] => {
  const fileId = penpotUuidOf(`${input.app}:file`)
  const manifest = {
    type: PENPOT_EXPORT_TYPE,
    version: 1,
    generatedBy: 'sovrium',
    files: [{ id: fileId, name: input.app, features: PENPOT_FILE_FEATURES }],
    relations: [],
  }
  const file = {
    id: fileId,
    name: input.app,
    features: PENPOT_FILE_FEATURES,
    revn: 1,
    vern: 0,
    isShared: false,
    options: { componentsV2: true },
    version: PENPOT_DATA_VERSION,
  }
  const entries = [
    { path: PENPOT_MANIFEST_PATH, text: serialise(manifest) },
    { path: `files/${fileId}.json`, text: serialise(file) },
    ...input.pages.flatMap((page, index) => pageEntries(input, page, index, fileId)),
  ]
  return entries.toSorted((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  )
}
