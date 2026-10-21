/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * BUILD: a Figma page document, drawn as boards on the current Figma page.
 *
 * The document is decoded with the CLI's own contract first
 * (`figmaPageDocumentSchema`, strictly), so the plugin draws only what
 * `sovrium design-system --format bundle` could have written. Then, per board,
 * one top-level frame, and per document node one layer, with:
 *
 * - its auto layout set field for field (the contract names its fields after
 *   the Plugin API properties, so nothing is translated);
 * - its bound variables resolved BY NAME to the file's existing local
 *   variables — the designer imports the bundle's `adapters/figma/*.tokens.json`
 *   with Figma's own Variables import first; the plugin never creates a
 *   variable, and refuses the whole document if one it needs is missing;
 * - its `sovrium` tag, exactly the contract's `{ id?, type }`;
 * - locked placements drawn as locked layers: a template placement as an
 *   instance of a local main component (kept beside the boards, in a frame
 *   the export ignores), an island as a locked frame.
 *
 * The build only ever CREATES layers. It refuses to draw a page whose boards
 * are already on the Figma page, so it never changes a layer that exists.
 */

import {
  figmaPageDocumentSchema,
  type FigmaPageDocument,
  type FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { FigmaPort, PortFrame, PortSceneNode, PortVariable, PortWritable } from './figma-port'
import {
  AUTO_LAYOUT_FIELDS,
  PLACED_FIELDS,
  SCALAR_FIELDS,
  presentFieldsOf,
  type ScalarField,
} from './node-fields'
import {
  BOARD_KEY,
  COMPONENTS_KEY,
  DRAWN_KEY,
  TAG_KEY,
  decodeBoard,
  documentEntries,
  encodeTag,
  type DrawnRecord,
  type DrawnValue,
} from './plugin-data'

/** The font a new text layer draws in (typings line 1342). */
export const TEXT_FONT = { family: 'Inter', style: 'Regular' } as const

/** The space left between boards, and between existing content and the first board, in px. */
const BOARD_GAP = 200

/** What a build did. */
export interface BuildSummary {
  readonly page: string
  readonly boards: number
  readonly layers: number
  /** Variables that more than one local collection names; the first was bound. */
  readonly ambiguousVariables: readonly string[]
  /** What Figma refused to set, layer by layer. Nothing was approximated in its place. */
  readonly warnings: readonly string[]
}

/** The build's answer. */
export type BuildResult =
  | { readonly ok: true; readonly summary: BuildSummary }
  | { readonly ok: false; readonly error: string }

interface BuildContext {
  readonly figma: FigmaPort
  readonly variables: ReadonlyMap<string, PortVariable>
  readonly holder: () => PortFrame
  readonly warn: (message: string) => void
  readonly count: () => void
}

/** Decode a document's text with the CLI's contract. */
export const decodeDocument = (
  text: string
):
  | { readonly ok: true; readonly document: FigmaPageDocument }
  | { readonly ok: false; readonly error: string } => {
  const json = (() => {
    try {
      return { value: JSON.parse(text) as unknown }
    } catch {
      return undefined
    }
  })()
  if (json === undefined) return { ok: false, error: 'The file is not JSON.' }
  const decoded = decodeSafe(figmaPageDocumentSchema)(json.value)
  return decoded.success
    ? { ok: true, document: decoded.data }
    : {
        ok: false,
        error: `The file is not a Sovrium Figma page document: ${decoded.error.message}`,
      }
}

/** Every variable name a list of layers binds, depth first. */
const boundNamesOf = (nodes: readonly FigmaPageNode[]): readonly string[] =>
  nodes.flatMap((node) => [
    ...Object.values(node.boundVariables ?? {}),
    ...boundNamesOf(node.children),
  ])

const hasText = (nodes: readonly FigmaPageNode[]): boolean =>
  nodes.some((node) => node.nodeType === 'TEXT' || hasText(node.children))

/** A field's value on a layer as Figma now holds it. */
const readScalar = (layer: PortSceneNode, field: ScalarField): DrawnValue | undefined =>
  layer[field]

const set = (layer: PortWritable, field: ScalarField, value: DrawnValue, context: BuildContext) => {
  try {
    ;(layer as unknown as Record<string, DrawnValue>)[field] = value
  } catch (error) {
    context.warn(`"${layer.name}": Figma refused ${field} = ${String(value)} (${String(error)}).`)
  }
}

/** A layer with auto layout and children: a frame, a component or an instance. */
const isFrameLike = (layer: PortWritable): layer is PortFrame =>
  'appendChild' in layer && layer.layoutMode !== undefined

/** The auto-layout fields, on a layer that has auto layout. */
const applyAutoLayout = (layer: PortWritable, node: FigmaPageNode, context: BuildContext) => {
  AUTO_LAYOUT_FIELDS.forEach((field) => {
    const value = node[field]
    if (value === undefined) return
    if (!isFrameLike(layer)) {
      context.warn(`"${node.name}": a ${node.nodeType} layer has no ${field}; it was not drawn.`)
      return
    }
    set(layer, field, value, context)
  })
}

/** What the layer sets once it sits in its parent, then its bindings, text and lock. */
const applyPlaced = (layer: PortWritable, node: FigmaPageNode, context: BuildContext) => {
  if (isFrameLike(layer) && layer.layoutMode !== 'NONE' && layer.layoutMode !== 'GRID') {
    // A new frame is 100 × 100 and fixed; one with auto layout hugs its children.
    set(layer, 'layoutSizingHorizontal', 'HUG', context)
    set(layer, 'layoutSizingVertical', 'HUG', context)
  }
  if (node.width !== undefined) layer.resize(node.width, layer.height)
  PLACED_FIELDS.forEach((field) => {
    const value = node[field]
    if (value !== undefined) set(layer, field, value, context)
  })
  Object.entries(node.boundVariables ?? {}).forEach(([field, name]) => {
    const variable = context.variables.get(name)
    if (variable === undefined) return
    try {
      layer.setBoundVariable(field, variable)
    } catch (error) {
      context.warn(`"${node.name}": Figma refused to bind ${field} to ${name} (${String(error)}).`)
    }
  })
  if (node.characters !== undefined) set(layer, 'characters', node.characters, context)
  if (node.locked !== undefined) set(layer, 'locked', node.locked, context)
}

/** The tag and the drawn record, last, so the baseline is the layer as built. */
const remember = (layer: PortWritable, node: FigmaPageNode) => {
  if (node.sovrium !== undefined) layer.setPluginData(TAG_KEY, encodeTag(node.sovrium))
  const baseline = Object.fromEntries(
    SCALAR_FIELDS.flatMap((field) => {
      const value = readScalar(layer, field)
      return value === undefined ? [] : [[field, value]]
    })
  )
  const record: DrawnRecord = {
    present: presentFieldsOf(node),
    baseline,
    ...(node.componentProperties === undefined || node.nodeType === 'INSTANCE'
      ? {}
      : { componentProperties: node.componentProperties }),
  }
  layer.setPluginData(DRAWN_KEY, JSON.stringify(record))
}

const buildChildren = async (
  nodes: readonly FigmaPageNode[],
  container: PortFrame,
  context: BuildContext
): Promise<void> => {
  // Sequential: drawing order IS the auto-layout order.
  await nodes.reduce<Promise<void>>(async (previous, child) => {
    await previous
    await buildNode(child, container, context)
  }, Promise.resolve())
}

/** A template placement or a kit instance: an instance of a local main component drawing its children. */
const buildInstance = async (
  node: FigmaPageNode,
  container: PortFrame,
  context: BuildContext
): Promise<PortWritable> => {
  const main = context.figma.createComponent()
  main.name = node.name
  main.fills = []
  applyAutoLayout(main, node, context)
  context.holder().appendChild(main)
  await buildChildren(node.children, main, context)
  if (main.layoutMode !== 'NONE') {
    main.primaryAxisSizingMode = 'AUTO'
    main.counterAxisSizingMode = 'AUTO'
  }
  Object.entries(node.componentProperties ?? {}).forEach(([property, value]) => {
    main.addComponentProperty(property, 'TEXT', value)
  })
  const instance = main.createInstance()
  container.appendChild(instance)
  applyPlaced(instance, node, context)
  return instance
}

const createLeaf = (node: FigmaPageNode, context: BuildContext): PortWritable => {
  if (node.nodeType === 'TEXT') return context.figma.createText()
  if (node.nodeType === 'RECTANGLE') return context.figma.createRectangle()
  if (node.nodeType === 'VECTOR') return context.figma.createVector()
  const frame = context.figma.createFrame()
  frame.fills = []
  return frame
}

/** A group: its children drawn in the container, then grouped where they stand. */
const buildGroup = async (
  node: FigmaPageNode,
  container: PortFrame,
  context: BuildContext
): Promise<PortWritable> => {
  const before = container.children.length
  await buildChildren(node.children, container, context)
  const members = container.children.slice(before)
  const group = context.figma.group(members, container)
  group.name = node.name
  applyPlaced(group, node, context)
  return group
}

/** One document node, drawn into `container`, then its children into it. */
async function buildNode(
  node: FigmaPageNode,
  container: PortFrame,
  context: BuildContext
): Promise<PortWritable> {
  context.count()
  if (node.nodeType === 'GROUP' && node.children.length === 0) {
    context.warn(`"${node.name}": Figma has no empty group; it was drawn as a frame.`)
  }
  const layer =
    node.nodeType === 'INSTANCE'
      ? await buildInstance(node, container, context)
      : node.nodeType === 'GROUP' && node.children.length > 0
        ? await buildGroup(node, container, context)
        : await (async () => {
            const leaf = createLeaf(node, context)
            leaf.name = node.name
            applyAutoLayout(leaf, node, context)
            container.appendChild(leaf)
            if (isFrameLike(leaf)) await buildChildren(node.children, leaf, context)
            else if (node.children.length > 0) {
              context.warn(
                `"${node.name}": a ${node.nodeType} layer has no children; they were not drawn.`
              )
            }
            applyPlaced(leaf, node, context)
            return leaf
          })()
  remember(layer, node)
  return layer
}

/** The right edge of what the page already holds. */
const rightEdgeOf = (layers: readonly PortSceneNode[]): number =>
  layers.reduce((edge, layer) => Math.max(edge, (layer.x ?? 0) + (layer.width ?? 0)), 0)

/** Local variables by name; a name two collections share is bound to the first, and listed. */
const variablesByName = (variables: readonly PortVariable[]) =>
  variables.reduce<{
    readonly byName: ReadonlyMap<string, PortVariable>
    readonly ambiguous: readonly string[]
  }>(
    ({ byName, ambiguous }, variable) =>
      byName.has(variable.name)
        ? {
            byName,
            ambiguous: ambiguous.includes(variable.name)
              ? ambiguous
              : [...ambiguous, variable.name],
          }
        : { byName: new Map([...byName, [variable.name, variable]]), ambiguous },
    { byName: new Map(), ambiguous: [] }
  )

/** Draw a decoded document on the current page. */
export const buildDocument = async (
  figma: FigmaPort,
  document: FigmaPageDocument
): Promise<BuildResult> => {
  if (!document.boards.some((board) => board.breakpoint === 'base')) {
    return { ok: false, error: `The page "${document.page}" has no base board.` }
  }
  const page = figma.currentPage
  const drawn = page.children.some(
    (layer) => decodeBoard(layer.getPluginData(BOARD_KEY))?.page === document.page
  )
  if (drawn) {
    return {
      ok: false,
      error: `The page "${document.page}" is already drawn on this Figma page. The plugin never changes a layer that exists: delete its boards, or open another Figma page, and import again.`,
    }
  }
  const wanted = [...new Set(document.boards.flatMap((board) => boundNamesOf(board.nodes)))]
  const { byName, ambiguous } = variablesByName(await figma.variables.getLocalVariablesAsync())
  const missing = wanted.filter((name) => !byName.has(name))
  if (missing.length > 0) {
    return {
      ok: false,
      error: `This file has no local variable named ${missing.map((name) => `"${name}"`).join(', ')}. Import the bundle's adapters/figma/*.tokens.json with Figma's Variables import first; the plugin never creates a variable. Nothing was drawn.`,
    }
  }
  if (document.boards.some((board) => hasText(board.nodes))) await figma.loadFontAsync(TEXT_FONT)

  const warnings: string[] = []
  const counter = { layers: 0 }
  const holderRef: { frame?: PortFrame } = {}
  const startX = rightEdgeOf(page.children) + BOARD_GAP
  const context: BuildContext = {
    figma,
    variables: byName,
    warn: (message) => warnings.push(message),
    count: () => {
      counter.layers += 1
    },
    holder: () => {
      if (holderRef.frame !== undefined) return holderRef.frame
      const holder = figma.createFrame()
      holder.name = `${document.page} — Sovrium components (the export ignores this frame)`
      holder.layoutMode = 'HORIZONTAL'
      holder.itemSpacing = 40
      holder.primaryAxisSizingMode = 'AUTO'
      holder.counterAxisSizingMode = 'AUTO'
      holder.x = startX
      holder.y = -BOARD_GAP * 4
      holder.setPluginData(COMPONENTS_KEY, document.page)
      page.appendChild(holder)
      holderRef.frame = holder
      return holder
    },
  }

  await document.boards.reduce<Promise<number>>(async (previous, board, rank) => {
    const x = await previous
    const frame = figma.createFrame()
    frame.name = `${document.page} — ${board.breakpoint}`
    frame.resize(board.width, 100)
    frame.layoutMode = 'VERTICAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'FIXED'
    frame.x = x
    frame.y = 0
    page.appendChild(frame)
    frame.setPluginData(
      BOARD_KEY,
      JSON.stringify({ page: document.page, breakpoint: board.breakpoint, rank })
    )
    if (board.breakpoint === 'base') {
      documentEntries(document).forEach(([key, value]) => frame.setPluginData(key, value))
    }
    await buildChildren(board.nodes, frame, context)
    return x + board.width + BOARD_GAP
  }, Promise.resolve(startX))

  return {
    ok: true,
    summary: {
      page: document.page,
      boards: document.boards.length,
      layers: counter.layers,
      ambiguousVariables: ambiguous.filter((name) => wanted.includes(name)),
      warnings,
    },
  }
}
