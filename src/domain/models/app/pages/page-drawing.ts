/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page DRAWING as the page import reads it: what a design tool's parser
 * hands the merge, whatever the tool.
 *
 * Each round-trip tool — a Claude Design canvas project, a Penpot file, the
 * Sovrium Figma plugin's page document — has its own parse half, and each
 * returns this shape. It is the design tree's shape (`page-design-tree.ts`),
 * plus the few things a drawing holds that the tree does not: a layer that is
 * no kit component, the text a bound or translated node is drawn with, a
 * placement's own variables, a digest of what a locked node draws inside, and
 * the page title a tool shows.
 *
 * ─── WHAT A PARSER MUST DO ─────────────────────────────────────────────────
 *
 * - Read the STRUCTURE from the base board only, and fold each breakpoint
 *   board's layout into `responsive.<bp>` of the node it tags.
 * - Fold a kit instance's own label layers into `content`: a button drawn with
 *   a text layer is one node whose content is that text, not two nodes.
 * - Keep a layer with no Sovrium tag as a node with no `type`, named, so the
 *   import can refuse it rather than lose it.
 * - Give a locked node (a template placement, an island) an `inside` digest
 *   of everything drawn under it, computed the same way every time: the merge
 *   only ever compares it with the digest of an unedited drawing.
 *
 * The merge never needs the parser to be clever: it compares every drawn
 * value with the same parser's reading of an unedited export of the config,
 * so whatever a parser makes of a value, an untouched value reads the same.
 */

import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** A layout value as a drawing holds it: what was drawn, and the token it was bound to. */
export interface DrawnLayoutEntry {
  readonly value: string
  readonly token?: string | undefined
}

/** A drawn layout, one entry per container layout property the drawing sets. */
export interface DrawnLayout {
  readonly direction?: DrawnLayoutEntry | undefined
  readonly gap?: DrawnLayoutEntry | undefined
  readonly align?: DrawnLayoutEntry | undefined
  readonly justify?: DrawnLayoutEntry | undefined
  readonly padding?: DrawnLayoutEntry | undefined
  readonly width?: DrawnLayoutEntry | undefined
}

/** One node of a drawing. */
export interface DrawnNode {
  /** The path id the layer is tagged with; absent on a layer the designer added. */
  readonly id?: string | undefined
  /** The kit component type; absent on a layer that is no kit component. */
  readonly type?: string | undefined
  /** The layer's name in the tool, to name a refused layer. */
  readonly name?: string | undefined
  readonly variant?: string | undefined
  readonly size?: string | undefined
  readonly layout?: DrawnLayout | undefined
  /** The layout each breakpoint board draws, by breakpoint name. */
  readonly responsive?: Readonly<Record<string, DrawnLayout>> | undefined
  /** The text the node draws of its own, bound, translated or literal. */
  readonly content?: string | undefined
  /** A template placement's own `$variable` values. */
  readonly vars?: Readonly<Record<string, string>> | undefined
  /** A digest of what a locked node draws inside, only ever compared with an unedited one. */
  readonly inside?: string | undefined
  readonly children: readonly DrawnNode[]
}

/** One node the export drew, as the drawing's stamp lists it. */
export interface DrawnStampEntry {
  readonly id: string
  /** The node's key at export time. */
  readonly key?: string | undefined
  readonly contentHash: string
}

/** One page of a drawing. */
export interface DrawnPage {
  /** The page, by the `name` of its config entry. */
  readonly page: string
  /** The drawing it was read from, as the source names it (a board file, a tool page). */
  readonly drawing?: string | undefined
  /** The page title the drawing shows, when the tool draws one. */
  readonly title?: string | undefined
  /**
   * Whether the drawing may show a SAMPLE value where the export drew a bound
   * value as its field name (`[name]`): a canvas a prototype was built on.
   * A sample in a placeholder's place is then no edit of the binding.
   */
  readonly samplesDrawn?: boolean | undefined
  /** The page's top-level nodes, from the base board. */
  readonly nodes: readonly DrawnNode[]
  /** Every node the export drew. */
  readonly stamp: readonly DrawnStampEntry[]
  /**
   * What the parser found but could not place on a node, already worded: a
   * layer that is no kit component, a value it could not read. The merge
   * reports each that an unedited drawing does not hold too.
   */
  readonly reported?:
    | {
        readonly notAKitComponent?: readonly DrawnReport[] | undefined
        readonly unread?: readonly DrawnReport[] | undefined
      }
    | undefined
}

/** One finding a parser worded, on a node or on the page. */
export interface DrawnReport {
  /** The node it was found on, by path id; the page's components when there is none. */
  readonly node: string
  readonly reason: string
}

/** A drawn node with the position the walk found it at, so two layers are never confused. */
export interface PlacedDrawnNode {
  /** The position, as dotted indexes from the top of the page (`1.0`). */
  readonly at: string
  readonly node: DrawnNode
}

/**
 * Every node of a drawing, depth first, each with its position.
 *
 * @param nodes - the top-level drawn nodes, or any node's children.
 * @param prefix - the position of the list, for a recursive walk.
 */
export const placedDrawnNodes = (
  nodes: readonly DrawnNode[],
  prefix = ''
): readonly PlacedDrawnNode[] =>
  nodes.flatMap((node, index) => {
    const at = `${prefix}${index}`
    return [{ at, node }, ...placedDrawnNodes(node.children, `${at}.`)]
  })

/** The tagged nodes of a drawing, by id; the first layer carrying an id wins. */
export const drawnNodesById = (page: DrawnPage): ReadonlyMap<string, DrawnNode> =>
  new Map(
    placedDrawnNodes(page.nodes)
      .toReversed()
      .flatMap(({ node }) => (node.id === undefined ? [] : [[node.id, node] as const]))
  )

/**
 * A tool parser's reading of one page: the drawing as a design tree, beside
 * what the tree cannot say. The parse halves of the page adapters answer in
 * this shape, and {@link drawnPageOfReading} turns it into a {@link DrawnPage}.
 */
export interface PageDrawingReading {
  /** The page as a design tree; a node the designer added carries a `<page>:/new/<n>` id. */
  readonly tree: {
    readonly page: string
    readonly nodes: readonly PageDesignTreeNode[]
  }
  /** The export stamp the drawing kept. */
  readonly exported: readonly DrawnStampEntry[]
  /** Each template placement's own variables, by node id. */
  readonly variables?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
  /** What each locked node draws inside, serialised, by node id. */
  readonly drawings?: Readonly<Record<string, string>> | undefined
  /** The lengths drawn off the scale, which the tree leaves out. */
  readonly offScale?:
    | readonly { readonly node: string; readonly property: string; readonly value: string }[]
    | undefined
  /** The layers that are no kit component, by the node they sit in and their index there. */
  readonly notAKitComponent?:
    | readonly {
        readonly name: string
        readonly parent?: string | undefined
        readonly index: number
      }[]
    | undefined
  /** The page title the drawing shows, when the tool draws one. */
  readonly title?: string | undefined
  /** The drawing it was read from (see {@link DrawnPage}). */
  readonly drawing?: string | undefined
  /** Whether a sample may stand in a placeholder's place (see {@link DrawnPage}). */
  readonly samplesDrawn?: boolean | undefined
  /** The findings the parser worded itself (see {@link DrawnPage}). */
  readonly reported?: DrawnPage['reported']
}

/**
 * Whether an id is one a parser gave a node the designer added (`<page>:/new/0`,
 * `<page>:/added/0`): every page node lives under `/components`, and no other
 * id can name one.
 */
const isAddedId = (id: string): boolean => !/^[^:]+:\/components\//.test(id)

/** A layout with each off-scale value the parser set aside put back, tokenless. */
const withOffScale = (
  layout: DrawnLayout | undefined,
  values: readonly (readonly [string, string])[]
): DrawnLayout | undefined =>
  values.length === 0
    ? layout
    : {
        ...layout,
        ...Object.fromEntries(values.map(([property, value]) => [property, { value }])),
      }

/** The off-scale values of one node, `[property, value]` for its base and for each breakpoint. */
const offScaleOf = (reading: PageDrawingReading, id: string) => {
  const own = (reading.offScale ?? []).filter((entry) => entry.node === id)
  const base = own.flatMap((entry) => {
    const [scope, property] = entry.property.split('.')
    return scope === 'layout' && property !== undefined ? [[property, entry.value] as const] : []
  })
  const responsive = own.flatMap((entry) => {
    const [scope, breakpoint, property] = entry.property.split('.')
    return scope === 'responsive' && breakpoint !== undefined && property !== undefined
      ? [[breakpoint, property, entry.value] as const]
      : []
  })
  return { base, responsive }
}

/** The layers that are no kit component, put back as untyped nodes where they were drawn. */
const withStrays = (
  reading: PageDrawingReading,
  parent: string | undefined,
  nodes: readonly DrawnNode[]
): readonly DrawnNode[] =>
  (reading.notAKitComponent ?? [])
    .filter((stray) => stray.parent === parent)
    .toSorted((a, b) => a.index - b.index)
    .reduce<readonly DrawnNode[]>((acc, stray, inserted) => {
      const at = Math.min(stray.index + inserted, acc.length)
      return [...acc.slice(0, at), { name: stray.name, children: [] }, ...acc.slice(at)]
    }, nodes)

/** One tree node of a reading, as a drawn node. */
const drawnNodeOf = (reading: PageDrawingReading, node: PageDesignTreeNode): DrawnNode => {
  const { base, responsive } = offScaleOf(reading, node.id)
  const breakpoints = [
    ...new Set([...Object.keys(node.responsive ?? {}), ...responsive.map(([bp]) => bp)]),
  ]
  const drawnResponsive = Object.fromEntries(
    breakpoints.map((breakpoint) => [
      breakpoint,
      withOffScale(
        node.responsive?.[breakpoint],
        responsive.flatMap(([bp, property, value]) =>
          bp === breakpoint ? [[property, value] as const] : []
        )
      ) ?? {},
    ])
  )
  // An absent field is `undefined` rather than missing: the merge compares by value.
  return {
    id: isAddedId(node.id) ? undefined : node.id,
    type: node.type,
    variant: node.variant,
    size: node.size,
    layout: withOffScale(node.layout, base),
    responsive: breakpoints.length === 0 ? undefined : drawnResponsive,
    content: node.content,
    vars: reading.variables?.[node.id],
    inside: reading.drawings?.[node.id],
    children: withStrays(
      reading,
      node.id,
      node.children.map((child) => drawnNodeOf(reading, child))
    ),
  }
}

/**
 * A tool parser's reading as the drawing the merge reads: added nodes lose
 * their placeholder id, set-aside off-scale lengths go back on their node so
 * the merge reports them, variables and inside digests join their node, and a
 * layer that is no kit component is put back where it was drawn, untyped.
 */
export const drawnPageOfReading = (reading: PageDrawingReading): DrawnPage => ({
  page: reading.tree.page,
  ...(reading.drawing === undefined ? {} : { drawing: reading.drawing }),
  ...(reading.samplesDrawn === undefined ? {} : { samplesDrawn: reading.samplesDrawn }),
  ...(reading.title === undefined ? {} : { title: reading.title }),
  nodes: withStrays(
    reading,
    undefined,
    reading.tree.nodes.map((node) => drawnNodeOf(reading, node))
  ),
  stamp: reading.exported,
  ...(reading.reported === undefined ? {} : { reported: reading.reported }),
})
