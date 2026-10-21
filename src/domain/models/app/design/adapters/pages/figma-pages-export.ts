/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The export half of the Figma page adapter: one page's design tree drawn as
 * the page document the Sovrium Figma plugin builds frames from
 * (`adapters/figma/pages/<name>.figma.json`, contract `adapter-figma-pages.ts`).
 *
 * ─── WHAT EACH NODE BECOMES ────────────────────────────────────────────────
 *
 * - a `text` node is a TEXT layer drawing its text;
 * - a template placement is a locked INSTANCE whose properties are the
 *   placement's own variables, drawing the template's text inside it, and at
 *   each of its slots the page's own components, tagged like any page node;
 * - an island is a locked FRAME drawing the rows the synthetic seed gave it;
 * - a node with children or a layout is a FRAME with its auto-layout;
 * - any other node is a kit INSTANCE carrying its `variant` and `size`, its
 *   literal text drawn as one `label` TEXT child.
 *
 * Every layer drawn from a tree node carries the plugin data `sovrium:{id,type}`;
 * a layer drawn INSIDE a node (a label, a template's text, a seeded cell)
 * carries none, and belongs to the node it sits in.
 *
 * ─── ONE BOARD PER BREAKPOINT ──────────────────────────────────────────────
 *
 * The page is drawn at {@link FIGMA_BASE_BOARD_WIDTH}, then once per breakpoint
 * its nodes set a layout at, each at the breakpoint's own width, smallest first.
 * Every board draws every node, with the layout that applies at its width.
 *
 * ─── DRAWN TEXT, NEVER AN EXPRESSION ───────────────────────────────────────
 *
 * Translated text is drawn in the default language, and a binding as the name
 * of the value it reads in brackets (`[name]`), so the document holds neither a
 * translation key nor a binding expression.
 */

import {
  FIGMA_PAGE_DOCUMENT_FORMAT,
  type FigmaPageDocument,
  type FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import {
  expandTemplateInputs,
  substitutableInputsOf,
} from '@/domain/models/app/pages/template-input-service'
import {
  COUNTER_AXIS_OF_ALIGN,
  FIGMA_BASE_BOARD_WIDTH,
  LAYOUT_MODE_OF_DIRECTION,
  PADDING_FIELDS,
  PRIMARY_AXIS_OF_JUSTIFY,
  cssLengthInPx,
  effectiveLayoutAt,
  figmaVariableName,
  type PageLayout,
  type PageLayoutValue,
} from './figma-pages-layout'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

/** Where the page documents live inside the bundle. */
export const FIGMA_PAGES_DIR = 'adapters/figma/pages'

/** The Figma token files every page document binds to, relative to the Figma adapter folder. */
export const FIGMA_VARIABLE_FILES = ['light.tokens.json', 'dark.tokens.json'] as const

/** The bundle path of a page's document. */
export const figmaPagePathOf = (page: string): string => `${FIGMA_PAGES_DIR}/${page}.figma.json`

type MapNode = PageNodeMap['pages'][number]['nodes'][number]
type AnyRecord = Readonly<Record<string, unknown>>

/** What an island draws: its column headers and the rows the synthetic seed gave it. */
export interface FigmaIslandDrawing {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/** What one page's document is drawn from. */
export interface FigmaPageExportInput {
  /** The page name. */
  readonly page: string
  /** The page's design tree nodes (`pages/<name>.tree.json`). */
  readonly nodes: readonly PageDesignTreeNode[]
  /** The page's node map entries, for each node's text and its content hash. */
  readonly map: readonly MapNode[]
  /** What each island draws, by node id: its column headers and the synthetic seed's rows. */
  readonly islands: Readonly<Record<string, FigmaIslandDrawing>>
  /** The app's templates (`components`), for what a placement draws. */
  readonly templates: readonly unknown[]
  /** The default language's translations, by key without `$t:`. */
  readonly translations: Readonly<Record<string, string>>
  /** Each breakpoint's width in px, as the Figma token files hold it. */
  readonly breakpoints: Readonly<Record<string, number>>
  /** Every variable the Figma token files define, by its Figma name. */
  readonly variables: ReadonlySet<string>
}

/** What every layer of one board is drawn against. */
interface BoardContext {
  readonly input: FigmaPageExportInput
  readonly entries: ReadonlyMap<string, MapNode>
  readonly breakpoint: string
  readonly order: readonly string[]
}

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const BINDING = /\$([A-Za-z_]\w*(?:\.\w+)+)/g
const VARIABLE = /\$([A-Za-z_]\w*)(?![.\w])/g

/** A binding drawn as the name of the value it reads, in brackets. */
const sampleOf = (expression: string): string =>
  expression.replaceAll(BINDING, (_match, path: string) => `[${path.split('.').at(-1) ?? path}]`)

/** A text as the page draws it: translated, its bindings as samples. */
const drawnText = (text: string, translations: Readonly<Record<string, string>>): string => {
  if (text.startsWith('$t:')) return translations[text.slice(3)] ?? text.slice(3)
  return sampleOf(text)
}

/** Whether a map property is the node's own text: its `content`, or its one string child. */
const isContent = (property: string): boolean => property === 'content' || property === 'children.0'

/** The text a tree node draws: its literal content, or what its map entry says it reads. */
const textOfNode = (node: PageDesignTreeNode, context: BoardContext): string | undefined => {
  if (node.content !== undefined) return node.content
  const entry = context.entries.get(node.id)
  const key = entry?.translations?.find((translation) => isContent(translation.property))?.key
  if (key !== undefined) return drawnText(key, context.input.translations)
  const expression = entry?.bindings?.find((binding) => isContent(binding.property))?.expression
  return expression === undefined ? undefined : sampleOf(expression)
}

const textLayer = (name: string, characters: string): FigmaPageNode => ({
  name,
  nodeType: 'TEXT',
  characters,
  children: [],
})

/** A px length bound to its token's variable, when the token files define it. */
const lengthOf = (
  value: PageLayoutValue | undefined,
  variables: ReadonlySet<string>
): { readonly px: number; readonly variable?: string } | undefined => {
  const px = value === undefined ? undefined : cssLengthInPx(value.value)
  if (px === undefined || value === undefined) return undefined
  const variable = value.token === undefined ? undefined : figmaVariableName(value.token)
  return variable !== undefined && variables.has(variable) ? { px, variable } : { px }
}

/** One px field and its binding. */
const lengthFields = (
  fields: readonly string[],
  length: ReturnType<typeof lengthOf>
): readonly (readonly [string, number, string | undefined])[] =>
  length === undefined ? [] : fields.map((field) => [field, length.px, length.variable] as const)

/** A layout as Figma auto-layout, each length in px and bound to its variable. */
const autoLayoutOf = (
  layout: PageLayout | undefined,
  variables: ReadonlySet<string>
): Partial<FigmaPageNode> => {
  if (layout === undefined) return {}
  const direction = layout.direction === undefined ? undefined : layout.direction.value
  const align = layout.align === undefined ? undefined : COUNTER_AXIS_OF_ALIGN[layout.align.value]
  const justify =
    layout.justify === undefined ? undefined : PRIMARY_AXIS_OF_JUSTIFY[layout.justify.value]
  const lengths = [
    ...lengthFields(['itemSpacing'], lengthOf(layout.gap, variables)),
    ...lengthFields(PADDING_FIELDS, lengthOf(layout.padding, variables)),
    ...lengthFields(['width'], lengthOf(layout.width, variables)),
  ]
  const bound = lengths.flatMap(([field, , variable]) =>
    variable === undefined ? [] : [[field, variable] as const]
  )
  return {
    layoutMode:
      (direction === undefined ? undefined : LAYOUT_MODE_OF_DIRECTION[direction]) ?? 'NONE',
    ...Object.fromEntries(lengths.map(([field, px]) => [field, px])),
    ...(justify === undefined ? {} : { primaryAxisAlignItems: justify }),
    ...(align === undefined ? {} : { counterAxisAlignItems: align }),
    ...(bound.length === 0 ? {} : { boundVariables: Object.fromEntries(bound) }),
  }
}

/** A template's text, its variables filled in, then drawn as the page draws it. */
const templateText = (
  text: string,
  vars: Readonly<Record<string, unknown>>,
  translations: Readonly<Record<string, string>>
): string =>
  drawnText(
    text.replaceAll(VARIABLE, (match, name: string) =>
      vars[name] === undefined ? match : String(vars[name])
    ),
    translations
  )

/** The layers a template node's slot marker draws: the page's slotted nodes, tagged. */
type SlotLayers = (marker: string) => readonly FigmaPageNode[]

/** What a template draws, as untagged layers, each slot drawing the page's own nodes. */
const templateLayers = (
  children: unknown,
  vars: Readonly<Record<string, unknown>>,
  translations: Readonly<Record<string, string>>,
  slotLayers: SlotLayers
): readonly FigmaPageNode[] =>
  (Array.isArray(children) ? (children as readonly unknown[]) : []).flatMap((child) => {
    if (typeof child === 'string')
      return [textLayer('text', templateText(child, vars, translations))]
    if (!isRecord(child)) return []
    const name = typeof child['type'] === 'string' ? child['type'] : 'layer'
    if (typeof child['content'] === 'string') {
      return [textLayer(name, templateText(child['content'], vars, translations))]
    }
    const inner = child['children']
    return [
      {
        name,
        nodeType: 'FRAME' as const,
        children:
          typeof inner === 'string'
            ? slotLayers(inner)
            : templateLayers(inner, vars, translations, slotLayers),
      },
    ]
  })

/**
 * The pointer segment a slot marker names under its placement: `children` for
 * `$children`, `slots/<name>` for `$slots.<name>`.
 */
const slotSegmentOf = (marker: string): string | undefined => {
  if (marker === '$children') return 'children'
  return marker.startsWith('$slots.') ? `slots/${marker.slice('$slots.'.length)}` : undefined
}

/**
 * The template a placement draws, and the values its text still takes. A
 * template that declares inputs is expanded first, exactly as the page draws
 * it, and its values are never read a second time.
 */
const placedTemplate = (
  template: unknown,
  vars: Readonly<Record<string, unknown>>
): { readonly template: unknown; readonly textVars: Readonly<Record<string, unknown>> } => {
  const inputs = substitutableInputsOf(template)
  if (inputs === undefined || !isRecord(template)) return { template, textVars: vars }
  const undeclared = Object.fromEntries(Object.entries(vars).filter(([name]) => !inputs.has(name)))
  return { template: expandTemplateInputs(template, inputs, vars).node, textVars: undeclared }
}

/** A template placement: a locked instance of its variables, drawing the template. */
const placementLayer = (node: PageDesignTreeNode, context: BoardContext): FigmaPageNode => {
  const provenance = context.entries.get(node.id)?.provenance
  const vars = (provenance?.variables ?? {}) as Readonly<Record<string, unknown>>
  const { template, textVars } = placedTemplate(
    context.input.templates.find(
      (candidate) => isRecord(candidate) && candidate['name'] === provenance?.name
    ),
    vars
  )
  // The components the page passes to a slot are its own tree nodes, drawn tagged.
  const slotLayers: SlotLayers = (marker) => {
    const segment = slotSegmentOf(marker)
    if (segment === undefined) return []
    const prefix = `${node.id}/${segment}/`
    return node.children
      .filter((child) => child.id.startsWith(prefix))
      .map((child) => layerOf(child, context))
  }
  return {
    name: node.key ?? node.type,
    nodeType: 'INSTANCE',
    sovrium: { id: node.id, type: node.type },
    locked: true,
    // A list or an object (a `json` input) has no one text a tool could edit.
    componentProperties: Object.fromEntries(
      Object.entries(vars).flatMap(([name, value]) =>
        typeof value === 'object' && value !== null ? [] : [[name, String(value)]]
      )
    ),
    children: !isRecord(template)
      ? []
      : typeof template['children'] === 'string'
        ? slotLayers(template['children'])
        : templateLayers(template['children'], textVars, context.input.translations, slotLayers),
  }
}

/** One row of seeded cells. */
const rowLayer = (name: string, cells: readonly string[]): FigmaPageNode => ({
  name,
  nodeType: 'FRAME',
  layoutMode: 'HORIZONTAL',
  children: cells.map((cell) => textLayer('cell', cell)),
})

/** An island: a locked frame drawing what the synthetic seed gave it. */
const islandLayer = (node: PageDesignTreeNode, context: BoardContext): FigmaPageNode => {
  const drawing = context.input.islands[node.id]
  return {
    name: node.key ?? node.type,
    nodeType: 'FRAME',
    sovrium: { id: node.id, type: node.type },
    locked: true,
    layoutMode: 'VERTICAL',
    children:
      drawing === undefined
        ? []
        : [
            rowLayer('header', drawing.headers),
            ...drawing.rows.map((row, index) => rowLayer(`row ${index + 1}`, row)),
          ],
  }
}

/** The `variant` and `size` a kit instance carries, absent when it sets neither. */
const instancePropertiesOf = (node: PageDesignTreeNode): Partial<FigmaPageNode> => {
  const properties = {
    ...(node.variant === undefined ? {} : { variant: node.variant }),
    ...(node.size === undefined ? {} : { size: node.size }),
  }
  return Object.keys(properties).length === 0 ? {} : { componentProperties: properties }
}

/** A container or a kit instance: its auto-layout, its properties, its label and its children. */
const componentLayer = (
  node: PageDesignTreeNode,
  context: BoardContext,
  text: string | undefined
): FigmaPageNode => {
  const layout = autoLayoutOf(
    effectiveLayoutAt(node, context.breakpoint, context.order),
    context.input.variables
  )
  const isFrame = node.children.length > 0 || Object.keys(layout).length > 0
  return {
    name: node.key ?? node.type,
    nodeType: isFrame ? 'FRAME' : 'INSTANCE',
    sovrium: { id: node.id, type: node.type },
    ...layout,
    ...instancePropertiesOf(node),
    children: [
      ...(text === undefined ? [] : [textLayer('label', text)]),
      ...node.children.map((child) => layerOf(child, context)),
    ],
  }
}

/** The layer drawn from one tree node, then its children's. */
function layerOf(node: PageDesignTreeNode, context: BoardContext): FigmaPageNode {
  if (node.locked === 'template') return placementLayer(node, context)
  if (node.locked !== undefined) return islandLayer(node, context)
  const text = textOfNode(node, context)
  if (node.type === 'text' && node.children.length === 0) {
    return {
      name: node.key ?? node.type,
      nodeType: 'TEXT',
      sovrium: { id: node.id, type: node.type },
      characters: text ?? '',
      children: [],
    }
  }
  return componentLayer(node, context, text)
}

/** Every tree node, depth first. */
const flatten = (nodes: readonly PageDesignTreeNode[]): readonly PageDesignTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)])

/** The breakpoints the page's layout uses, smallest first; one without a width is not drawn. */
const breakpointsUsed = (input: FigmaPageExportInput): readonly string[] =>
  [...new Set(flatten(input.nodes).flatMap((node) => Object.keys(node.responsive ?? {})))]
    .filter((breakpoint) => input.breakpoints[breakpoint] !== undefined)
    .toSorted((left, right) => (input.breakpoints[left] ?? 0) - (input.breakpoints[right] ?? 0))

/**
 * One page's Figma page document: a board at the base width and one per
 * breakpoint its layout uses, and the stamp of every node it drew.
 */
export const exportFigmaPage = (input: FigmaPageExportInput): FigmaPageDocument => {
  const entries = new Map(input.map.map((entry) => [entry.id, entry]))
  const order = breakpointsUsed(input)
  const boardAt = (breakpoint: string, width: number) => {
    const context: BoardContext = { input, entries, breakpoint, order }
    return {
      breakpoint,
      width: Math.round(width),
      nodes: input.nodes.map((node) => layerOf(node, context)),
    }
  }
  return {
    format: FIGMA_PAGE_DOCUMENT_FORMAT,
    version: 1,
    page: input.page,
    variables: [...FIGMA_VARIABLE_FILES],
    boards: [
      boardAt('base', FIGMA_BASE_BOARD_WIDTH),
      ...order.map((breakpoint) => boardAt(breakpoint, input.breakpoints[breakpoint] ?? 0)),
    ],
    exported: flatten(input.nodes).flatMap((node) => {
      const entry = entries.get(node.id)
      return entry === undefined
        ? []
        : [
            {
              id: node.id,
              ...(node.key === undefined ? {} : { key: node.key }),
              contentHash: entry.contentHash,
            },
          ]
    }),
  }
}

/** Every token path of a DTCG document, dotted. */
const tokenPathsOf = (node: unknown, prefix: readonly string[] = []): readonly string[] => {
  if (!isRecord(node)) return []
  if ('$value' in node) return [prefix.join('.')]
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, child]) => tokenPathsOf(child, [...prefix, key]))
}

/**
 * What a page document binds to, read off the Figma light token file: every
 * variable by its Figma name, and each breakpoint's width in px.
 */
export const figmaBindingsOf = (
  lightTokens: unknown
): Pick<FigmaPageExportInput, 'variables' | 'breakpoints'> => {
  const breakpoints = isRecord(lightTokens) ? lightTokens['breakpoint'] : undefined
  return {
    variables: new Set(tokenPathsOf(lightTokens).map(figmaVariableName)),
    breakpoints: Object.fromEntries(
      Object.entries(isRecord(breakpoints) ? breakpoints : {}).flatMap(([name, token]) => {
        const value = isRecord(token) && isRecord(token['$value']) ? token['$value'] : undefined
        return typeof value?.['value'] === 'number' ? [[name, value['value']]] : []
      })
    ),
  }
}
