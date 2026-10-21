/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parse half of the Penpot page adapter: a `.penpot` file a designer
 * edited, read back as each page's design tree.
 *
 * The caller opens the archive (bounded, the binary v1 format refused, see
 * `penpot-pages-format.ts`) and hands over its JSON entries as text. An entry
 * whose name would climb out of the archive refuses the whole file.
 *
 * ─── READ AS THE FIGMA PAGE DOCUMENT IS ────────────────────────────────────
 *
 * Each page's board is turned back into the layers of a Figma page document
 * (`figma-pages-export.ts` draws both from the same layers), and read by the
 * Figma page parse: so a Penpot drawing and a Figma one are read by the same
 * rules — the structure in drawing order, a kit component's label as its
 * content, a shape with no Sovrium tag reported as no kit component, a
 * duplicated tag read as a new node, a locked node read as its box, and each
 * length read back onto the spacing scale or reported, never approximated.
 *
 * What Penpot says better than Figma is kept as Penpot says it: a reversed
 * flex direction is read as itself.
 *
 * ─── WHAT IS NOT READ ──────────────────────────────────────────────────────
 *
 * A shape outside a page's board, a Penpot page holding no Sovrium board, and
 * every non-JSON entry (media, thumbnails) are left alone. A frame's width is
 * its drawn size, not a layout the page sets, so it is never read back.
 */

import {
  MAX_JSON_NESTING,
  nestsDeeperThan,
} from '@/domain/kernel/config-parsing/json-nesting-depth'
import { FIGMA_PAGE_DOCUMENT_FORMAT } from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { pageExportStampSchema } from '@/domain/models/api/admin/design-system/page-design-tree'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { parseJson, type ImportSource } from '../import/canonical-tokens-service'
import { COUNTER_AXIS_OF_ALIGN, PRIMARY_AXIS_OF_JUSTIFY } from './figma-pages-layout'
import { readFigmaPageDocument, type FigmaPageReading } from './figma-pages-parse'
import {
  type PageDrawingFinding,
  type PageDrawingParse,
  type ParsedPageDrawing,
} from './page-drawing'
import {
  PENPOT_EXPORT_TYPE,
  PENPOT_MANIFEST_PATH,
  PENPOT_PLUGIN_NAMESPACE,
  PENPOT_ROOT_FRAME_ID,
  isSafePenpotEntryName,
} from './penpot-pages-format'
import type { PenpotArchiveEntry } from './penpot-pages-export'
import type {
  FigmaPageDocument,
  FigmaPageNode,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** The spacing scale lengths are read back onto: `design.spacing`, a step to its CSS length. */
export interface PenpotPageScale {
  readonly spacing: Readonly<Record<string, string>>
}

/** One page read back. */
export interface PenpotPageRead {
  /** The Penpot page it was read from, by its name in Penpot. */
  readonly board: string
  readonly reading: FigmaPageReading
  /** Whether the board still carried a valid export stamp. */
  readonly stamped: boolean
}

/** The parse's answer: every page read and every Penpot page passed over, or why the file is refused. */
export type PenpotFileParseResult =
  | {
      readonly ok: true
      readonly pages: readonly PenpotPageRead[]
      readonly refused: readonly PageDrawingFinding[]
    }
  | { readonly ok: false; readonly error: string }

type Json = Readonly<Record<string, unknown>>

/** How deep a board's frames may nest before the file is refused. */
const MAX_DEPTH = 64

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/** A shape's Sovrium plugin data, every value a string. */
const tagOf = (shape: Json): Readonly<Record<string, string>> | undefined => {
  const data = isRecord(shape['pluginData'])
    ? shape['pluginData'][PENPOT_PLUGIN_NAMESPACE]
    : undefined
  if (!isRecord(data)) return undefined
  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : []
    )
  )
}

/** The text a text shape draws: its paragraphs' leaves, one line per paragraph. */
const charactersOf = (content: unknown): string => {
  const paragraphs = (node: unknown): readonly unknown[] => {
    if (!isRecord(node)) return []
    if (node['type'] === 'paragraph') return [node]
    return Array.isArray(node['children']) ? node['children'].flatMap(paragraphs) : []
  }
  const leaves = (node: unknown): string => {
    if (!isRecord(node)) return ''
    if (typeof node['text'] === 'string') return node['text']
    return Array.isArray(node['children']) ? node['children'].map(leaves).join('') : ''
  }
  return paragraphs(content).map(leaves).join('\n')
}

/** A JSON-encoded record of strings, `{}` when it is not one. */
const recordOfText = (text: string | undefined): Readonly<Record<string, string>> => {
  const value = text === undefined ? undefined : parseJson(text)
  return isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) =>
          typeof item === 'string' ? [[key, item]] : []
        )
      )
    : {}
}

/** A record without its `undefined` fields. */
const defined = <T extends Readonly<Record<string, unknown>>>(record: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>

/** A non-negative px value of a record, by key. */
const pxAt = (record: unknown, key: string): number | undefined => {
  const value = isRecord(record) ? numberOf(record[key]) : undefined
  return value === undefined ? undefined : Math.max(0, value)
}

/** The axis a Penpot flex direction runs along, as Figma's layout mode. */
const layoutModeOf = (direction: string | undefined): FigmaPageNode['layoutMode'] => {
  if (direction === undefined) return 'NONE'
  return direction.startsWith('row') ? 'HORIZONTAL' : 'VERTICAL'
}

/** A shape's flex layout as Figma auto-layout, which the Figma parse reads. */
const autoLayoutOf = (shape: Json): Partial<FigmaPageNode> => {
  if (shape['layout'] !== 'flex') return {}
  const layoutMode = layoutModeOf(stringOf(shape['layoutFlexDir']))
  const padding = shape['layoutPadding']
  return {
    layoutMode,
    ...defined({
      itemSpacing: pxAt(shape['layoutGap'], layoutMode === 'VERTICAL' ? 'rowGap' : 'columnGap'),
      paddingTop: pxAt(padding, 'p1'),
      paddingRight: pxAt(padding, 'p2'),
      paddingBottom: pxAt(padding, 'p3'),
      paddingLeft: pxAt(padding, 'p4'),
      primaryAxisAlignItems: PRIMARY_AXIS_OF_JUSTIFY[stringOf(shape['layoutJustifyContent']) ?? ''],
      counterAxisAlignItems: COUNTER_AXIS_OF_ALIGN[stringOf(shape['layoutAlignItems']) ?? ''],
    }),
  }
}

/** The shapes of one page, by id. */
type Shapes = ReadonlyMap<string, Json>

/** A frame's children in drawing order: Penpot lists them from the last in flow. */
const childrenOf = (shape: Json, shapes: Shapes): readonly Json[] =>
  (Array.isArray(shape['shapes']) ? shape['shapes'] : []).toReversed().flatMap((id) => {
    const child = typeof id === 'string' ? shapes.get(id) : undefined
    return child === undefined ? [] : [child]
  })

/** The Sovrium tag a layer carries, read off a shape's plugin data. */
const sovriumOf = (tag: Readonly<Record<string, string>> | undefined): FigmaPageNode['sovrium'] => {
  const type = tag?.['type']
  if (type === undefined) return undefined
  const id = tag?.['id']
  return id === undefined ? { type } : { id, type }
}

/** The properties a tagged frame carries: a placement's variables, or a variant and a size. */
const propertiesOf = (
  tag: Readonly<Record<string, string>> | undefined,
  lock: string | undefined
): Readonly<Record<string, string>> =>
  lock === 'template'
    ? recordOfText(tag?.['vars'])
    : (defined({ variant: tag?.['variant'], size: tag?.['size'] }) as Readonly<
        Record<string, string>
      >)

/** A shape's name as the layers panel shows it. */
const layerNameOf = (shape: Json): string =>
  stringOf(shape['name']) ?? stringOf(shape['type']) ?? 'shape'

/** The Figma layer a Penpot shape reads as, its children with it; `undefined` past the depth bound. */
const layerOf = (shape: Json, shapes: Shapes, depth: number): FigmaPageNode | undefined => {
  if (depth > MAX_DEPTH) return undefined
  const tag = tagOf(shape)
  const name = layerNameOf(shape)
  const sovrium = sovriumOf(tag)
  const tagged = sovrium === undefined ? {} : { sovrium }
  if (shape['type'] === 'text') {
    return {
      name,
      nodeType: 'TEXT',
      ...tagged,
      characters: charactersOf(shape['content']),
      children: [],
    }
  }
  const children = childrenOf(shape, shapes).map((child) => layerOf(child, shapes, depth + 1))
  if (children.some((child) => child === undefined)) return undefined
  const lock = sovrium === undefined ? undefined : tag?.['lock']
  const properties = propertiesOf(tag, lock)
  return {
    name,
    nodeType: lock === 'template' ? 'INSTANCE' : 'FRAME',
    ...tagged,
    ...(lock === undefined ? autoLayoutOf(shape) : { locked: true }),
    ...(Object.keys(properties).length === 0 ? {} : { componentProperties: properties }),
    children: children as readonly FigmaPageNode[],
  }
}

/**
 * How many shapes a walk below `shape` visits, or `undefined` once it passes
 * `budget`. A page draws each of its shapes once, so a walk that visits more
 * shapes than the page holds reached one shape twice: a file listing a child
 * in two frames, or twice in one, would otherwise make every walk below it
 * grow exponentially with the depth.
 */
const visitsBelow = (shape: Json, shapes: Shapes, budget: number): number | undefined =>
  childrenOf(shape, shapes).reduce<number | undefined>((spent, child) => {
    if (spent === undefined || spent >= budget) return undefined
    const below = visitsBelow(child, shapes, budget - spent - 1)
    return below === undefined ? undefined : spent + 1 + below
  }, 0)

/** The reversed flex direction each tagged shape draws, the first shape of an id winning. */
const reversedDirections = (board: Json, shapes: Shapes): ReadonlyMap<string, string> => {
  const walk = (shape: Json, depth: number): readonly (readonly [string, string])[] => {
    if (depth > MAX_DEPTH) return []
    const id = tagOf(shape)?.['id']
    const direction = stringOf(shape['layoutFlexDir'])
    const own =
      id !== undefined && shape['layout'] === 'flex' && direction?.endsWith('-reverse') === true
        ? [[id, direction] as const]
        : []
    return [...own, ...childrenOf(shape, shapes).flatMap((child) => walk(child, depth + 1))]
  }
  return new Map(walk(board, 0).toReversed())
}

/** The tree with each reversed direction put back as Penpot draws it. */
const withReversed = (
  nodes: readonly PageDesignTreeNode[],
  reversed: ReadonlyMap<string, string>
): readonly PageDesignTreeNode[] =>
  nodes.map((node) => {
    const direction = reversed.get(node.id)
    const children = withReversed(node.children, reversed)
    if (direction === undefined || node.layout?.direction === undefined)
      return { ...node, children }
    return { ...node, layout: { ...node.layout, direction: { value: direction } }, children }
  })

/** The layers a board draws, or why they cannot be read: a shape drawn twice, or nested too deep. */
const boardLayersOf = (board: Json, shapes: Shapes): readonly FigmaPageNode[] | string => {
  if (visitsBelow(board, shapes, shapes.size) === undefined) {
    return 'a shape of its board is drawn in more than one place'
  }
  const nodes = childrenOf(board, shapes).map((shape) => layerOf(shape, shapes, 1))
  return nodes.some((node) => node === undefined)
    ? `its shapes nest deeper than ${MAX_DEPTH} levels`
    : (nodes as readonly FigmaPageNode[])
}

/** The export stamp a board carries, and whether it was a valid one. */
const stampOf = (tag: Readonly<Record<string, string>>) => {
  const decoded = decodeSafe(pageExportStampSchema)(parseJson(tag['stamp'] ?? ''))
  return decoded.success
    ? { exported: decoded.data, stamped: true }
    : { exported: [] as FigmaPageDocument['exported'], stamped: false }
}

/** One Penpot page: its record and its shapes. */
interface PenpotPage {
  readonly name: string
  readonly index: number
  readonly shapes: Shapes
}

/** Read one Penpot page's board, or say why it holds none. */
const readPage = (
  page: PenpotPage,
  scale: PenpotPageScale
): PenpotPageRead | PageDrawingFinding => {
  const root = page.shapes.get(PENPOT_ROOT_FRAME_ID)
  const board =
    root === undefined
      ? undefined
      : childrenOf(root, page.shapes).find((shape) => tagOf(shape)?.['page'] !== undefined)
  const tag = board === undefined ? undefined : tagOf(board)
  const name = tag?.['page']
  if (board === undefined || tag === undefined || name === undefined) {
    return { board: page.name, detail: 'the Penpot page holds no Sovrium board' }
  }
  const nodes = boardLayersOf(board, page.shapes)
  if (typeof nodes === 'string') return { board: page.name, detail: nodes }
  const { exported, stamped } = stampOf(tag)
  const document: FigmaPageDocument = {
    format: FIGMA_PAGE_DOCUMENT_FORMAT,
    version: 1,
    page: name,
    variables: [],
    boards: [
      {
        breakpoint: 'base',
        width: Math.max(1, Math.round(numberOf(board['width']) ?? 1)),
        nodes,
      },
    ],
    exported,
  }
  const read = readFigmaPageDocument(document, scale)
  if (!read.ok) return { board: page.name, detail: read.error }
  const reading: FigmaPageReading = {
    ...read.value,
    tree: {
      ...read.value.tree,
      nodes: withReversed(read.value.tree.nodes, reversedDirections(board, page.shapes)),
    },
  }
  return { board: page.name, reading, stamped }
}

/** The ids of the files the manifest names, or why it is no Penpot manifest. */
const filesOfManifest = (text: string | undefined): readonly string[] | string => {
  const manifest = text === undefined ? undefined : parseJson(text)
  if (!isRecord(manifest)) return 'The Penpot file holds no readable manifest.json.'
  if (manifest['type'] !== PENPOT_EXPORT_TYPE || manifest['version'] !== 1) {
    return `The Penpot file's manifest is not a "${PENPOT_EXPORT_TYPE}" version 1 export.`
  }
  const files = Array.isArray(manifest['files']) ? manifest['files'] : []
  return files.flatMap((file) => {
    const id = isRecord(file) ? stringOf(file['id']) : undefined
    return id === undefined || !/^[0-9a-f-]{36}$/.test(id) ? [] : [id]
  })
}

/** Every page of one Penpot file in the archive, in Penpot's order. */
const pagesOfFile = (
  fileId: string,
  documents: ReadonlyMap<string, unknown>
): readonly PenpotPage[] => {
  const prefix = `files/${fileId}/pages/`
  const records = [...documents].flatMap(([path, value]) => {
    const rest = path.startsWith(prefix) ? path.slice(prefix.length) : undefined
    if (rest === undefined || rest.includes('/') || !rest.endsWith('.json')) return []
    return isRecord(value) ? [{ id: rest.slice(0, -'.json'.length), record: value }] : []
  })
  return records
    .map(({ id, record }) => {
      const folder = `${prefix}${id}/`
      const shapes = [...documents].flatMap(([path, value]) =>
        path.startsWith(folder) &&
        !path.slice(folder.length).includes('/') &&
        isRecord(value) &&
        typeof value['id'] === 'string'
          ? [[value['id'], value] as const]
          : []
      )
      return {
        name: stringOf(record['name']) ?? id,
        index: numberOf(record['index']) ?? 0,
        shapes: new Map(shapes),
      }
    })
    .toSorted((left, right) => left.index - right.index || (left.name < right.name ? -1 : 1))
}

/**
 * Read a Penpot file's JSON entries: every page that holds a Sovrium board,
 * as its design tree. A file whose entries are unsafe, or whose manifest is
 * not a Penpot export, is refused whole.
 */
export const parsePenpotFile = (
  entries: readonly PenpotArchiveEntry[],
  scale: PenpotPageScale
): PenpotFileParseResult => {
  const unsafe = entries.find((entry) => !isSafePenpotEntryName(entry.path))
  if (unsafe !== undefined) {
    return {
      ok: false,
      error: `The Penpot file holds an entry outside the archive: "${unsafe.path}".`,
    }
  }
  const files = filesOfManifest(entries.find((entry) => entry.path === PENPOT_MANIFEST_PATH)?.text)
  if (typeof files === 'string') return { ok: false, error: files }
  const documents = new Map(
    entries
      .filter((entry) => entry.path.endsWith('.json'))
      .map((entry) => [entry.path, parseJson(entry.text)] as const)
  )
  // A shape's text content is walked recursively; nesting past the bound would
  // overflow that walk, so the file is refused before anything is read.
  const deep = [...documents].find(([, value]) => nestsDeeperThan(value))
  if (deep !== undefined) {
    return {
      ok: false,
      error: `The Penpot file holds "${deep[0]}", nested deeper than ${MAX_JSON_NESTING} levels.`,
    }
  }
  const reads = files
    .flatMap((fileId) => pagesOfFile(fileId, documents))
    .map((page) => readPage(page, scale))
  return {
    ok: true,
    pages: reads.flatMap((read) => ('reading' in read ? [read] : [])),
    refused: reads.flatMap((read) => ('reading' in read ? [] : [read])),
  }
}

/** Whether a source's files are a Penpot export: its manifest names the Penpot export format. */
export const isPenpotExport = (files: readonly PenpotArchiveEntry[]): boolean => {
  const manifest = files.find((file) => file.path === PENPOT_MANIFEST_PATH)
  const value = manifest === undefined ? undefined : parseJson(manifest.text)
  return isRecord(value) && value['type'] === PENPOT_EXPORT_TYPE
}

/** A length off the scale, worded as a finding. */
const offScaleDetail = (value: FigmaPageReading['offScale'][number]): string =>
  `${value.property} is drawn at ${value.value}, on no step of the spacing scale` +
  (value.nearestToken === undefined ? '' : ` (the nearest is ${value.nearestToken})`)

/**
 * Read a Penpot file as the page import's shared parse: one drawing per page,
 * each off-scale value and each shape that is no kit component worded.
 */
export const fromPenpot = (
  source: ImportSource,
  options: { readonly spacing?: Readonly<Record<string, string>> | undefined } = {}
): PageDrawingParse => {
  const read = parsePenpotFile(source.files, { spacing: options.spacing ?? {} })
  if (!read.ok)
    return {
      format: 'penpot',
      pages: [],
      refused: [{ board: source.entry ?? '', detail: read.error }],
    }
  return {
    format: 'penpot',
    pages: read.pages.map(({ board, reading, stamped }): ParsedPageDrawing => ({
      board,
      tree: reading.tree,
      exported: reading.exported,
      stamped,
      offScale: reading.offScale.map((value) => ({
        board,
        node: value.node,
        detail: offScaleDetail(value),
      })),
      notAKitComponent: reading.notAKitComponent.map((stray) => ({
        board,
        node: stray.parent,
        detail: `"${stray.name}" carries no Sovrium tag, so it is no kit component`,
      })),
    })),
    refused: read.refused,
  }
}
