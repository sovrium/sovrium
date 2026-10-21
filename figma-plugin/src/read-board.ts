/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * EXPORT: the boards on the current Figma page, written back as the same
 * Figma page document the CLI reads (`sovrium design-system import --pages
 * --from figma`), export stamp included.
 *
 * A field is written when the document set it (the drawn record remembers
 * which), or when the layer now holds a value other than the one it was built
 * with — that is the designer's edit. A layer the plugin did not build is
 * compared with Figma's defaults instead, so a frame the designer added writes
 * the auto layout they gave it. A value the contract cannot carry (`GRID` auto
 * layout) is reported and left out, never folded into a near one; the CLI then
 * reports what it cannot place, as it does for any drawing.
 *
 * Every document is decoded with the contract before it leaves, so the plugin
 * can never hand the CLI a file the CLI would refuse.
 *
 * Reading never writes: no `set*` call is reachable from this module.
 */

import {
  FIGMA_PAGE_DOCUMENT_FORMAT,
  figmaPageDocumentSchema,
  type FigmaPageDocument,
  type FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { figmaPagePathOf } from '@/domain/models/app/design/adapters/pages/figma-pages-export'
import type { FigmaPort, PortSceneNode } from './figma-port'
import {
  CONTRACT_VALUES,
  FIGMA_DEFAULTS,
  SCALAR_FIELDS,
  contractNodeTypeOf,
  type ScalarField,
} from './node-fields'
import {
  BOARD_KEY,
  DRAWN_KEY,
  TAG_KEY,
  decodeBoard,
  decodeDrawn,
  decodeTag,
  readDocumentRecord,
  type BoardRecord,
  type DrawnValue,
} from './plugin-data'

/** One page read back, with the Figma layer each document node came from. */
export interface ReadPage {
  readonly document: FigmaPageDocument
  /** The Figma layer id of each node object in `document`. */
  readonly layerOf: ReadonlyMap<FigmaPageNode, string>
}

/** What an export read. */
export interface ReadResult {
  readonly pages: readonly ReadPage[]
  readonly warnings: readonly string[]
}

interface ReadContext {
  readonly figma: FigmaPort
  readonly variableNames: Map<string, string | undefined>
  readonly layerOf: Map<FigmaPageNode, string>
  readonly warn: (message: string) => void
}

/**
 * A layer's plugin data. An instance's sublayer (`I<instance>;<main layer>`)
 * may not carry what its main component's layer carries, so the main layer is
 * asked when the sublayer answers nothing.
 */
const dataOf = async (layer: PortSceneNode, key: string, context: ReadContext): Promise<string> => {
  const own = layer.getPluginData(key)
  if (own !== '' || !layer.id.includes(';')) return own
  const mainId = layer.id.split(';').at(-1)
  const main = mainId === undefined ? null : await context.figma.getNodeByIdAsync(mainId)
  return main?.getPluginData(key) ?? ''
}

const isAlias = (value: unknown): value is { readonly id: string } =>
  typeof value === 'object' &&
  value !== null &&
  (value as Readonly<Record<string, unknown>>)['type'] === 'VARIABLE_ALIAS' &&
  typeof (value as Readonly<Record<string, unknown>>)['id'] === 'string'

const variableName = async (id: string, context: ReadContext): Promise<string | undefined> => {
  if (context.variableNames.has(id)) return context.variableNames.get(id)
  const variable = await context.figma.variables.getVariableByIdAsync(id)
  context.variableNames.set(id, variable?.name)
  return variable?.name
}

/** The variable each scalar field is bound to, by name; paints and text ranges are not page layout. */
const boundOf = async (
  layer: PortSceneNode,
  context: ReadContext
): Promise<Readonly<Record<string, string>>> => {
  const entries = await Promise.all(
    Object.entries(layer.boundVariables ?? {}).map(async ([field, alias]) => {
      if (!isAlias(alias)) return undefined
      const name = await variableName(alias.id, context)
      if (name === undefined) {
        context.warn(
          `"${layer.name}": ${field} is bound to a variable this file cannot read; left out.`
        )
        return undefined
      }
      return [field, name] as const
    })
  )
  return Object.fromEntries(entries.filter((entry) => entry !== undefined))
}

/** An instance's component properties by their plain name (`label#12:3` reads as `label`). */
const instancePropertiesOf = (layer: PortSceneNode): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(layer.componentProperties ?? {}).map(([key, property]) => [
      key.split('#')[0] ?? key,
      String(property.value),
    ])
  )

/** The scalar fields to write: set by the document, or changed since the build. */
const scalarsOf = (
  layer: PortSceneNode,
  present: ReadonlySet<string>,
  baseline: Readonly<Record<string, DrawnValue>> | undefined,
  context: ReadContext
): Partial<Record<ScalarField, DrawnValue>> =>
  Object.fromEntries(
    SCALAR_FIELDS.flatMap((field) => {
      const value: DrawnValue | undefined = layer[field]
      if (value === undefined) return []
      const allowed = CONTRACT_VALUES[field]
      if (allowed !== undefined && !allowed.includes(String(value))) {
        context.warn(
          `"${layer.name}": ${field} ${String(value)} has no place in the page document; left out.`
        )
        return []
      }
      const before = baseline?.[field] ?? FIGMA_DEFAULTS[field]
      return present.has(field) || value !== before ? [[field, value]] : []
    })
  )

/** One layer and its children, as a document node; `undefined` for a layer that is not drawn. */
async function readLayer(
  layer: PortSceneNode,
  context: ReadContext
): Promise<FigmaPageNode | undefined> {
  const nodeType = contractNodeTypeOf(layer.type)
  if (nodeType === undefined) return undefined
  const tag = decodeTag(await dataOf(layer, TAG_KEY, context))
  const drawn = decodeDrawn(await dataOf(layer, DRAWN_KEY, context))
  const present = new Set(drawn?.present ?? [])
  const scalars = scalarsOf(layer, present, drawn?.baseline, context)
  const bound = await boundOf(layer, context)
  const properties =
    nodeType === 'INSTANCE' ? instancePropertiesOf(layer) : (drawn?.componentProperties ?? {})
  const children = (
    await Promise.all((layer.children ?? []).map((child) => readLayer(child, context)))
  ).filter((child) => child !== undefined)
  const width =
    (present.has('width') || bound['width'] !== undefined) && layer.width !== undefined
      ? layer.width
      : undefined
  const pick = (field: ScalarField) =>
    scalars[field] === undefined ? {} : { [field]: scalars[field] }
  // Keys in the contract's order, so two exports of one drawing serialise alike.
  const node = {
    name: layer.name,
    nodeType,
    ...(tag === undefined ? {} : { sovrium: tag }),
    ...pick('locked'),
    ...pick('layoutMode'),
    ...pick('itemSpacing'),
    ...pick('paddingTop'),
    ...pick('paddingRight'),
    ...pick('paddingBottom'),
    ...pick('paddingLeft'),
    ...pick('primaryAxisAlignItems'),
    ...pick('counterAxisAlignItems'),
    ...(width === undefined ? {} : { width }),
    ...pick('layoutSizingHorizontal'),
    ...pick('layoutSizingVertical'),
    ...pick('layoutPositioning'),
    ...(present.has('boundVariables') || Object.keys(bound).length > 0
      ? { boundVariables: bound }
      : {}),
    ...pick('characters'),
    ...(present.has('componentProperties') || Object.keys(properties).length > 0
      ? { componentProperties: properties }
      : {}),
    children,
  } as FigmaPageNode
  context.layerOf.set(node, layer.id)
  return node
}

/** One Sovrium page's boards, as its document. */
const readPage = async (
  page: string,
  boards: readonly (readonly [PortSceneNode, BoardRecord])[],
  context: ReadContext
): Promise<FigmaPageDocument | undefined> => {
  const ordered = boards.toSorted(([, left], [, right]) => left.rank - right.rank)
  const base = ordered.find(([, record]) => record.breakpoint === 'base')
  const record = base === undefined ? undefined : readDocumentRecord(base[0])
  if (record === undefined) {
    context.warn(
      `The page "${page}" has no base board carrying its export stamp; it was not exported. Import its document again.`
    )
    return undefined
  }
  const drawn = await Promise.all(
    ordered.map(async ([frame, board]) => ({
      breakpoint: board.breakpoint,
      width: Math.max(1, Math.round(frame.width ?? 0)),
      nodes: (
        await Promise.all((frame.children ?? []).map((layer) => readLayer(layer, context)))
      ).filter((node) => node !== undefined),
    }))
  )
  const document: FigmaPageDocument = {
    format: FIGMA_PAGE_DOCUMENT_FORMAT,
    version: 1,
    page,
    variables: record.variables,
    boards: drawn,
    exported: record.exported,
  }
  const decoded = decodeSafe(figmaPageDocumentSchema)(document)
  if (!decoded.success) {
    context.warn(
      `The page "${page}" did not read back as a page document: ${decoded.error.message}`
    )
    return undefined
  }
  return document
}

/** Every Sovrium page drawn on the current Figma page, read back. */
export const readBoards = async (figma: FigmaPort): Promise<ReadResult> => {
  const warnings: string[] = []
  const boards = figma.currentPage.children.flatMap((layer) => {
    const record = decodeBoard(layer.getPluginData(BOARD_KEY))
    return record === undefined ? [] : [[layer, record] as const]
  })
  const pageNames = [...new Set(boards.map(([, record]) => record.page))]
  const pages = await Promise.all(
    pageNames.map(async (page) => {
      const layerOf = new Map<FigmaPageNode, string>()
      const context: ReadContext = {
        figma,
        variableNames: new Map(),
        layerOf,
        warn: (message) => warnings.push(message),
      }
      const document = await readPage(
        page,
        boards.filter(([, record]) => record.page === page),
        context
      )
      return document === undefined ? undefined : { document, layerOf }
    })
  )
  return { pages: pages.filter((page) => page !== undefined), warnings }
}

/** The file a page document is downloaded as: the name the bundle gives it, without its folder. */
export const documentFileName = (document: FigmaPageDocument): string =>
  figmaPagePathOf(document.page).split('/').at(-1) ?? `${document.page}.figma.json`

/** The document's text, as the download writes it. */
export const documentText = (document: FigmaPageDocument): string =>
  `${JSON.stringify(document, null, 2)}\n`
