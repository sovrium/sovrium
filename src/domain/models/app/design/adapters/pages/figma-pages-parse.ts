/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parse half of the Figma page adapter: a page document the Sovrium Figma
 * plugin wrote back, read as the page's DESIGN TREE (the shape of
 * `pages/<name>.tree.json`) beside what the tree cannot say.
 *
 * The document is decoded with its contract first, strictly: an unknown field
 * refuses the whole file, so nothing the plugin could not have written reaches
 * the import.
 *
 * ─── WHAT IS READ, AND FROM WHICH BOARD ────────────────────────────────────
 *
 * Structure, order, text, variant and size are read off the BASE board; each
 * other board contributes only the layout its layers draw, as `responsive.<bp>`.
 * That layout is the one that APPLIES on the board (the cascade included), so
 * it is compared with {@link effectiveLayoutAt} of the config's node, never
 * with its raw override. A value the document does not draw is absent, and
 * absence never means removal: Figma cannot unset a layout property.
 *
 * ─── NOTHING IS APPROXIMATED ───────────────────────────────────────────────
 *
 * A length is read back to the spacing step whose px it equals, preferring the
 * variable it is bound to, or to a tokenless `0.25rem` multiple as the tree
 * itself writes an undeclared step. Any other length is listed in `offScale`
 * with the nearest declared step, and left out of the tree. A layer with no
 * `sovrium` plugin data is not a kit component: it is listed in
 * `notAKitComponent` and its tagged layers are read where it sits. A layer
 * tagged with no id, or with an id an earlier layer already took, is a new
 * node, given the id `<page>:/new/<n>` in drawing order.
 *
 * ─── LOCKED LAYERS ─────────────────────────────────────────────────────────
 *
 * A locked layer is read as its box only: a template placement's own
 * variables go to `variables`, and everything drawn inside it to `drawings`,
 * serialised, so an import compares it with the export's own drawing of the
 * same node and refuses or ignores an edit inside. The one exception is a
 * tagged layer inside a placement: a component the page passes to one of the
 * template's slots, read as the placement's child like any page node, and
 * standing in the drawing by its tag alone.
 */

import { Chunk, HashSet } from 'effect'
import {
  MAX_JSON_NESTING,
  nestsDeeperThan,
} from '@/domain/kernel/config-parsing/json-nesting-depth'
import {
  FIGMA_PAGE_DOCUMENT_FORMAT,
  figmaPageDocumentSchema,
  type FigmaPageDocument,
  type FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import {
  PAGE_DESIGN_TREE_FORMAT,
  type PageDesignTree,
  type PageDesignTreeNode,
} from '@/domain/models/api/admin/design-system/page-design-tree'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { printNumber, roundTo } from '../adapter-units'
import { parseJson } from '../import/canonical-tokens-service'
import {
  COUNTER_AXIS_OF_ALIGN,
  DIRECTION_OF_LAYOUT_MODE,
  PADDING_FIELDS,
  PRIMARY_AXIS_OF_JUSTIFY,
  cssLengthInPx,
  inverted,
  tokenOfFigmaVariable,
  type PageLayout,
  type PageLayoutValue,
} from './figma-pages-layout'

/** The spacing scale lengths are read back onto: `design.spacing`, a step to its CSS length. */
export interface FigmaPageScale {
  readonly spacing: Readonly<Record<string, string>>
}

/** A drawn length on no step of the scale. */
export interface FigmaOffScaleValue {
  readonly node: string
  /** `layout.<property>` on the base board, `responsive.<bp>.<property>` on another. */
  readonly property: string
  /** As drawn, in px (`13px`; four lengths for unequal paddings). */
  readonly value: string
  /** The closest declared spacing step, when the value is one length. */
  readonly nearestToken?: string | undefined
}

/** A layer that is no kit component: no `sovrium` plugin data. */
export interface FigmaStrayLayer {
  readonly name: string
  readonly nodeType: FigmaPageNode['nodeType']
  /** The node it sits in; absent at the top of the page. */
  readonly parent?: string | undefined
  /** Its index among the parent's read children, where it would have stood. */
  readonly index: number
}

/** A Figma page document, read. */
export interface FigmaPageReading {
  /** The page as a design tree, read off the drawing. */
  readonly tree: PageDesignTree
  /** The export stamp, as the plugin kept it. */
  readonly exported: FigmaPageDocument['exported']
  /** Each template placement's own variables, as drawn, by node id. */
  readonly variables: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** What each locked layer draws inside, serialised, by node id. */
  readonly drawings: Readonly<Record<string, string>>
  readonly offScale: readonly FigmaOffScaleValue[]
  readonly notAKitComponent: readonly FigmaStrayLayer[]
}

/** The parse's answer: the reading, or why the document cannot be read. */
export type FigmaPageParseResult =
  | { readonly ok: true; readonly value: FigmaPageReading }
  | { readonly ok: false; readonly error: string }

/** Whether a parsed JSON value is a Figma page document, by its format identifier alone. */
export const isFigmaPageDocument = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as Readonly<Record<string, unknown>>)['format'] === FIGMA_PAGE_DOCUMENT_FORMAT

const ALIGN_OF_COUNTER_AXIS = inverted(COUNTER_AXIS_OF_ALIGN)
const JUSTIFY_OF_PRIMARY_AXIS = inverted(PRIMARY_AXIS_OF_JUSTIFY)

/** A length read: a tree value, or an off-scale report without its node and property. */
type LengthRead =
  | { readonly value: PageLayoutValue }
  | { readonly offScale: Omit<FigmaOffScaleValue, 'node' | 'property'> }

/** The declared steps, smallest first, with their px. */
const stepsOf = (scale: FigmaPageScale) =>
  Object.entries(scale.spacing)
    .flatMap(([step, css]) => {
      const px = cssLengthInPx(css)
      return px === undefined ? [] : [{ step, css, px }]
    })
    .toSorted((left, right) => left.px - right.px)

/** One length back on the scale, the bound variable's step first. */
const lengthRead = (px: number, bound: string | undefined, scale: FigmaPageScale): LengthRead => {
  const steps = stepsOf(scale)
  const boundToken = bound === undefined ? undefined : tokenOfFigmaVariable(bound)
  const onStep =
    steps.find((step) => `spacing.${step.step}` === boundToken && step.px === px) ??
    steps.find((step) => step.px === px)
  if (onStep !== undefined) {
    return { value: { value: onStep.css, token: `spacing.${onStep.step}` } }
  }
  if (Number.isInteger(px) && px % 4 === 0) return { value: { value: `${roundTo(px / 16)}rem` } }
  const nearest = steps.reduce<(typeof steps)[number] | undefined>(
    (best, step) =>
      best === undefined || Math.abs(step.px - px) < Math.abs(best.px - px) ? step : best,
    undefined
  )
  return {
    offScale: {
      value: `${printNumber(px)}px`,
      ...(nearest === undefined ? {} : { nearestToken: `spacing.${nearest.step}` }),
    },
  }
}

/** What one layer's layout reads as. */
interface LayoutRead {
  readonly layout: PageLayout | undefined
  readonly offScale: readonly FigmaOffScaleValue[]
}

/** The padding a layer draws, when it draws one. */
const paddingRead = (layer: FigmaPageNode, scale: FigmaPageScale): LengthRead | undefined => {
  const sides = PADDING_FIELDS.map((field) => layer[field])
  if (sides.every((side) => side === undefined)) return undefined
  const [top = 0, ...rest] = sides.map((side) => side ?? 0)
  if (rest.every((side) => side === top)) {
    return lengthRead(top, layer.boundVariables?.['paddingTop'], scale)
  }
  return { offScale: { value: sides.map((side) => `${printNumber(side ?? 0)}px`).join(' ') } }
}

/** A value read straight off a table, `undefined` when the field or its entry is absent. */
const keyword = (
  value: string | undefined,
  table: Readonly<Record<string, string>>
): { readonly value: string } | undefined => {
  const mapped = value === undefined ? undefined : table[value]
  return mapped === undefined ? undefined : { value: mapped }
}

/** The enumerated half of a layer's layout: its direction and its two alignments. */
const keywordsRead = (layer: FigmaPageNode): PageLayout => {
  const direction = keyword(layer.layoutMode, DIRECTION_OF_LAYOUT_MODE)
  const align = keyword(layer.counterAxisAlignItems, ALIGN_OF_COUNTER_AXIS)
  const justify = keyword(layer.primaryAxisAlignItems, JUSTIFY_OF_PRIMARY_AXIS)
  return {
    ...(direction === undefined ? {} : { direction }),
    ...(align === undefined ? {} : { align }),
    ...(justify === undefined ? {} : { justify }),
  }
}

/** The lengths a layer draws, each read back onto the scale. */
const lengthsRead = (
  layer: FigmaPageNode,
  scale: FigmaPageScale
): readonly (readonly [keyof PageLayout, LengthRead])[] => {
  const bound = layer.boundVariables ?? {}
  const gap =
    layer.itemSpacing === undefined
      ? undefined
      : lengthRead(layer.itemSpacing, bound['itemSpacing'], scale)
  // An unbound width is the frame's drawn size, not a layout the page sets.
  const width =
    layer.width === undefined || bound['width'] === undefined
      ? undefined
      : lengthRead(layer.width, bound['width'], scale)
  const lengths: readonly (readonly [keyof PageLayout, LengthRead | undefined])[] = [
    ['gap', gap],
    ['padding', paddingRead(layer, scale)],
    ['width', width],
  ]
  return lengths.flatMap(([property, read]) => (read === undefined ? [] : [[property, read]]))
}

/** A layer's auto-layout as tree layout values, off-scale lengths reported. */
const layoutRead = (
  layer: FigmaPageNode,
  scale: FigmaPageScale,
  node: string,
  prefix: string
): LayoutRead => {
  const lengths = lengthsRead(layer, scale)
  const layout: PageLayout = {
    ...keywordsRead(layer),
    ...Object.fromEntries(
      lengths.flatMap(([property, read]) => ('value' in read ? [[property, read.value]] : []))
    ),
  }
  return {
    layout: Object.keys(layout).length === 0 ? undefined : layout,
    offScale: lengths.flatMap(([property, read]) =>
      'offScale' in read ? [{ node, property: `${prefix}.${property}`, ...read.offScale }] : []
    ),
  }
}

/** What a list of layers reads as. */
interface Read {
  readonly nodes: readonly PageDesignTreeNode[]
  readonly variables: readonly (readonly [string, Readonly<Record<string, string>>])[]
  readonly drawings: readonly (readonly [string, string])[]
  readonly offScale: readonly FigmaOffScaleValue[]
  readonly stray: readonly FigmaStrayLayer[]
}

const EMPTY: Read = { nodes: [], variables: [], drawings: [], offScale: [], stray: [] }

const joined = (reads: readonly Read[]): Read => ({
  nodes: reads.flatMap((read) => read.nodes),
  variables: reads.flatMap((read) => read.variables),
  drawings: reads.flatMap((read) => read.drawings),
  offScale: reads.flatMap((read) => read.offScale),
  stray: reads.flatMap((read) => read.stray),
})

/** What the walk of the base board reads against. */
interface WalkContext {
  readonly scale: FigmaPageScale
  readonly keys: ReadonlyMap<string, string>
  /** The id each tagged layer is read as, by its position in the board. */
  readonly ids: ReadonlyMap<string, string>
}

/** The layer that is a node's own text: its one untagged TEXT child, on a non-text layer. */
const labelOf = (layer: FigmaPageNode): FigmaPageNode | undefined => {
  const untagged = layer.children.filter((child) => child.sovrium === undefined)
  const [only] = untagged
  return layer.nodeType !== 'TEXT' && untagged.length === 1 && only?.nodeType === 'TEXT'
    ? only
    : undefined
}

/**
 * The tagged layers a locked layer draws inside — the components a page passes
 * to a template's slots — each with its position; a tagged layer's own inside
 * is its own.
 */
const slottedOf = (
  layers: readonly FigmaPageNode[],
  position: string
): readonly (readonly [string, FigmaPageNode])[] =>
  layers.flatMap((layer, index) => {
    const at = `${position}/${index}`
    return layer.sovrium === undefined ? slottedOf(layer.children, at) : [[at, layer] as const]
  })

/**
 * A locked layer's drawing as an import compares it — names, types, text and
 * nesting only — each slotted layer standing in by its tag alone.
 */
const lockedDrawingOf = (layers: readonly FigmaPageNode[]): unknown =>
  layers.map((layer) =>
    layer.sovrium === undefined
      ? {
          name: layer.name,
          nodeType: layer.nodeType,
          ...(layer.characters === undefined ? {} : { characters: layer.characters }),
          children: lockedDrawingOf(layer.children),
        }
      : { slotted: layer.sovrium.type }
  )

/**
 * A locked layer: its box, its variables, and its drawing. The page's own
 * components a template placement draws in its slots are read as its children,
 * like any page node, and left out of the drawing an import compares.
 */
const lockedRead = (
  layer: FigmaPageNode,
  id: string,
  position: string,
  context: WalkContext
): Read => {
  const key = context.keys.get(id)
  const template = layer.nodeType === 'INSTANCE'
  const slotted = template
    ? joined(
        slottedOf(layer.children, position).map(([at, inner]) => {
          const innerId = context.ids.get(at)
          if (innerId === undefined) return EMPTY
          return inner.locked === true
            ? lockedRead(inner, innerId, at, context)
            : nodeRead(inner, innerId, at, context)
        })
      )
    : EMPTY
  return {
    ...slotted,
    nodes: [
      {
        id,
        ...(key === undefined ? {} : { key }),
        type: layer.sovrium?.type ?? '',
        locked: template ? 'template' : 'island',
        children: slotted.nodes,
      },
    ],
    variables: [
      ...(template ? [[id, layer.componentProperties ?? {}] as const] : []),
      ...slotted.variables,
    ],
    drawings: [[id, JSON.stringify(lockedDrawingOf(layer.children))], ...slotted.drawings],
  }
}

/** Where a list of layers sits: the node it is in, its position in the board, its label. */
interface Where {
  readonly parent: string | undefined
  readonly position: string
  /** The node's own text layer, read as its content rather than as a child. */
  readonly label?: FigmaPageNode | undefined
}

/** A layer's own drawn fields: its `variant`, its `size` and its text. */
const ownFieldsOf = (
  layer: FigmaPageNode,
  label: FigmaPageNode | undefined
): Pick<PageDesignTreeNode, 'variant' | 'size' | 'content'> => {
  const { variant, size } = layer.componentProperties ?? {}
  const content = layer.nodeType === 'TEXT' ? layer.characters : label?.characters
  return {
    ...(variant === undefined ? {} : { variant }),
    ...(size === undefined ? {} : { size }),
    ...(content === undefined ? {} : { content }),
  }
}

/** A tagged, unlocked layer and its children. */
const nodeRead = (
  layer: FigmaPageNode,
  id: string,
  position: string,
  context: WalkContext
): Read => {
  const label = labelOf(layer)
  const children = readLayers(layer.children, { parent: id, position, label }, context)
  const { layout, offScale } = layoutRead(layer, context.scale, id, 'layout')
  const key = context.keys.get(id)
  const { content, ...properties } = ownFieldsOf(layer, label)
  const node: PageDesignTreeNode = {
    id,
    ...(key === undefined ? {} : { key }),
    type: layer.sovrium?.type ?? '',
    ...properties,
    ...(layout === undefined ? {} : { layout }),
    ...(content === undefined ? {} : { content }),
    children: children.nodes,
  }
  return { ...children, nodes: [node], offScale: [...offScale, ...children.offScale] }
}

/**
 * A list of layers, in drawing order, the node's own label skipped; an untagged
 * layer is reported and its tagged layers read where it sits.
 */
function readLayers(layers: readonly FigmaPageNode[], where: Where, context: WalkContext): Read {
  // Each sibling's read is appended to a chunk and the lists are joined once:
  // joining them per sibling made a wide board quadratic.
  const { reads } = layers.reduce<{ readonly reads: Chunk.Chunk<Read>; readonly count: number }>(
    (acc, layer, index) => {
      if (layer === where.label) return acc
      const at = `${where.position}/${index}`
      const id = context.ids.get(at)
      const read =
        id === undefined
          ? strayRead(layer, at, { ...where, index: acc.count }, context)
          : layer.locked === true
            ? lockedRead(layer, id, at, context)
            : nodeRead(layer, id, at, context)
      return { reads: Chunk.append(acc.reads, read), count: acc.count + read.nodes.length }
    },
    { reads: Chunk.empty(), count: 0 }
  )
  return joined(Chunk.toReadonlyArray(reads))
}

/** An untagged layer: reported, and its tagged layers read where it sits. */
function strayRead(
  layer: FigmaPageNode,
  at: string,
  where: Where & { readonly index: number },
  context: WalkContext
): Read {
  const stray: FigmaStrayLayer = {
    name: layer.name,
    nodeType: layer.nodeType,
    ...(where.parent === undefined ? {} : { parent: where.parent }),
    index: where.index,
  }
  const through = readLayers(layer.children, { parent: where.parent, position: at }, context)
  return { ...through, stray: [stray, ...through.stray] }
}

/**
 * Every tagged layer of a board, depth first, by its position. A locked
 * layer's inside is walked too: what a template draws there is untagged, and
 * the only tagged layers inside one are the page's components in its slots.
 */
const taggedOf = (
  layers: readonly FigmaPageNode[],
  position: string
): readonly (readonly [string, FigmaPageNode])[] =>
  layers.flatMap((layer, index) => {
    const at = `${position}/${index}`
    const own = layer.sovrium === undefined ? [] : [[at, layer] as const]
    return [...own, ...taggedOf(layer.children, at)]
  })

/** The id each tagged layer is read as: its own the first time, a new one otherwise. */
const idsOf = (page: string, tagged: readonly (readonly [string, FigmaPageNode])[]) =>
  new Map(
    Chunk.toReadonlyArray(
      tagged.reduce<{
        readonly entries: Chunk.Chunk<readonly [string, string]>
        readonly taken: HashSet.HashSet<string>
        readonly fresh: number
      }>(
        ({ entries, taken, fresh }, [at, layer]) => {
          const own = layer.sovrium?.id
          const keeps = own !== undefined && !HashSet.has(taken, own)
          const id = keeps ? own : `${page}:/new/${fresh}`
          return {
            entries: Chunk.append(entries, [at, id] as const),
            taken: HashSet.add(taken, id),
            fresh: keeps ? fresh : fresh + 1,
          }
        },
        { entries: Chunk.empty(), taken: HashSet.empty(), fresh: 0 }
      ).entries
    )
  )

/** The layout one board draws for each tagged node, by id; the first layer of an id wins. */
const boardLayouts = (
  board: FigmaPageDocument['boards'][number],
  scale: FigmaPageScale
): ReadonlyMap<string, LayoutRead> => {
  const drawn = taggedOf(board.nodes, '').flatMap(([, layer]) => {
    const id = layer.sovrium?.id
    return id === undefined || layer.locked === true ? [] : [[id, layer] as const]
  })
  // The first layer of an id, kept in drawing order: the index each id is first at.
  const firstAt = new Map(drawn.map(([id], index) => [id, index] as const).toReversed())
  return new Map(
    drawn.flatMap(([id, layer], index) =>
      firstAt.get(id) === index
        ? [[id, layoutRead(layer, scale, id, `responsive.${board.breakpoint}`)] as const]
        : []
    )
  )
}

/** The tree with each other board's layout as `responsive.<bp>`. */
const withResponsive = (
  nodes: readonly PageDesignTreeNode[],
  boards: readonly (readonly [string, ReadonlyMap<string, LayoutRead>])[]
): readonly PageDesignTreeNode[] =>
  nodes.map((node) => {
    const responsive = Object.fromEntries(
      boards.flatMap(([breakpoint, layouts]) => {
        const layout = layouts.get(node.id)?.layout
        return layout === undefined ? [] : [[breakpoint, layout]]
      })
    )
    // The keys in the order the design tree writes them, so the two serialise alike.
    const { id, key, type, variant, size, layout, content, locked } = node
    return {
      id,
      ...(key === undefined ? {} : { key }),
      type,
      ...(variant === undefined ? {} : { variant }),
      ...(size === undefined ? {} : { size }),
      ...(layout === undefined ? {} : { layout }),
      ...(Object.keys(responsive).length === 0 ? {} : { responsive }),
      ...(content === undefined ? {} : { content }),
      ...(locked === undefined ? {} : { locked }),
      children: withResponsive(node.children, boards),
    }
  })

/** Every id of a tree, depth first. */
const idsIn = (nodes: readonly PageDesignTreeNode[]): ReadonlySet<string> =>
  new Set(nodes.flatMap((node) => [node.id, ...idsIn(node.children)]))

/** Read a decoded Figma page document. */
export const readFigmaPageDocument = (
  document: FigmaPageDocument,
  scale: FigmaPageScale
): FigmaPageParseResult => {
  const base = document.boards.find((board) => board.breakpoint === 'base')
  if (base === undefined) {
    return { ok: false, error: `The Figma page document of "${document.page}" has no base board.` }
  }
  const context: WalkContext = {
    scale,
    keys: new Map(
      document.exported.flatMap((entry) => (entry.key === undefined ? [] : [[entry.id, entry.key]]))
    ),
    ids: idsOf(document.page, taggedOf(base.nodes, '')),
  }
  const read = readLayers(base.nodes, { parent: undefined, position: '' }, context)
  const known = idsIn(read.nodes)
  const others = document.boards
    .filter((board) => board.breakpoint !== 'base')
    .map((board) => [board.breakpoint, boardLayouts(board, scale)] as const)
  return {
    ok: true,
    value: {
      tree: {
        format: PAGE_DESIGN_TREE_FORMAT,
        version: 1,
        page: document.page,
        nodes: withResponsive(read.nodes, others),
      },
      exported: document.exported,
      variables: Object.fromEntries(read.variables),
      drawings: Object.fromEntries(read.drawings),
      offScale: [
        ...read.offScale,
        ...others.flatMap(([, layouts]) =>
          [...layouts].flatMap(([id, layout]) => (known.has(id) ? layout.offScale : []))
        ),
      ],
      notAKitComponent: read.stray,
    },
  }
}

/**
 * Parse the text of a Figma page document: decode it with its contract, then
 * read it. A file that is not JSON, or not the document the plugin writes, is
 * refused whole.
 */
export const parseFigmaPage = (text: string, scale: FigmaPageScale): FigmaPageParseResult => {
  const json = parseJson(text)
  if (json === undefined) return { ok: false, error: 'The Figma page document is not JSON.' }
  if (nestsDeeperThan(json)) {
    return {
      ok: false,
      error: `The Figma page document nests deeper than ${MAX_JSON_NESTING} levels.`,
    }
  }
  const decoded = decodeSafe(figmaPageDocumentSchema)(json)
  return decoded.success
    ? readFigmaPageDocument(decoded.data, scale)
    : {
        ok: false,
        error: `The Figma page document does not match the Sovrium plugin's format: ${decoded.error.message}`,
      }
}
