/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the plugin stores on a layer, and how it reads it back.
 *
 * Four keys, all private plugin data (`setPluginData`, typings line 6524):
 *
 * | Key | On | Holds |
 * | --- | --- | --- |
 * | `sovrium` | every layer drawn from a page node | the contract's tag, `{ id?, type }`, exactly |
 * | `sovrium-drawn` | every layer the plugin built | which contract fields the document SET, and each field's value as built |
 * | `sovrium-board` | each board frame | the page, the breakpoint and the board's rank |
 * | `sovrium-document:<n>` | the base board | the document's `variables` and its export stamp, in chunks |
 *
 * `sovrium` is the contract (`figmaPageNodeTagSchema`) and is decoded with it,
 * strictly: a tag the contract would refuse is read as no tag. The other three
 * are the plugin's own bookkeeping, needed because a Figma layer always HAS an
 * `itemSpacing` and four paddings — the plugin must know which of them the
 * document wrote, and which the designer changed since, to write the same
 * document back.
 *
 * Plugin data is private to the plugin ID and capped at 100 kB per entry; the
 * stamp is the only value that can grow with the page, so it alone is chunked.
 */

import {
  figmaPageNodeTagSchema,
  type FigmaPageDocument,
} from '@/domain/models/api/admin/design-system/adapter-figma-pages'
import { pageExportStampSchema } from '@/domain/models/api/admin/design-system/page-design-tree'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import type { PortBaseNode } from './figma-port'

export const TAG_KEY = 'sovrium'
export const DRAWN_KEY = 'sovrium-drawn'
export const BOARD_KEY = 'sovrium-board'
export const COMPONENTS_KEY = 'sovrium-components'
const DOCUMENT_KEY = 'sovrium-document'

/** Below Figma's 100 kB per entry, with room for the multi-byte characters a length in UTF-16 hides. */
export const CHUNK_LENGTH = 30_000

/** The contract's node tag. */
export type NodeTag = typeof figmaPageNodeTagSchema.Type

/** A scalar contract field's value. */
export type DrawnValue = string | number | boolean

/** What the plugin remembers of a layer it built. */
export interface DrawnRecord {
  /** The contract fields the document set on this layer. */
  readonly present: readonly string[]
  /** Each scalar field's value right after the build, so an edit shows as a difference. */
  readonly baseline: Readonly<Record<string, DrawnValue>>
  /** `componentProperties` of a layer that is not an instance, which Figma has no field for. */
  readonly componentProperties?: Readonly<Record<string, string>> | undefined
}

/** A board's own data. */
export interface BoardRecord {
  readonly page: string
  readonly breakpoint: string
  readonly rank: number
}

/** The document fields no layer carries. */
export type DocumentRecord = Pick<FigmaPageDocument, 'variables' | 'exported'>

const parsed = (text: string): unknown => {
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The tag JSON, keys in the contract's order. */
export const encodeTag = (tag: NodeTag): string =>
  JSON.stringify({ ...(tag.id === undefined ? {} : { id: tag.id }), type: tag.type })

/** A stored tag, or `undefined` when there is none or the contract refuses it. */
export const decodeTag = (text: string): NodeTag | undefined => {
  const value = parsed(text)
  if (value === undefined) return undefined
  const decoded = decodeSafe(figmaPageNodeTagSchema)(value)
  return decoded.success ? decoded.data : undefined
}

const stringRecord = (value: unknown): Readonly<Record<string, string>> | undefined =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')
    ? (value as Readonly<Record<string, string>>)
    : undefined

/** A stored drawn record, or `undefined` for a layer the plugin did not build. */
export const decodeDrawn = (text: string): DrawnRecord | undefined => {
  const value = parsed(text)
  if (!isRecord(value)) return undefined
  const { present, baseline, componentProperties } = value
  if (!Array.isArray(present) || !present.every((field) => typeof field === 'string')) {
    return undefined
  }
  if (!isRecord(baseline)) return undefined
  const properties = stringRecord(componentProperties)
  return {
    present: present as readonly string[],
    baseline: Object.fromEntries(
      Object.entries(baseline).filter(
        (entry): entry is [string, DrawnValue] =>
          typeof entry[1] === 'string' ||
          typeof entry[1] === 'number' ||
          typeof entry[1] === 'boolean'
      )
    ),
    ...(properties === undefined ? {} : { componentProperties: properties }),
  }
}

/** A stored board record, or `undefined` for a frame that is no board. */
export const decodeBoard = (text: string): BoardRecord | undefined => {
  const value = parsed(text)
  if (!isRecord(value)) return undefined
  const { page, breakpoint, rank } = value
  return typeof page === 'string' && typeof breakpoint === 'string' && typeof rank === 'number'
    ? { page, breakpoint, rank }
    : undefined
}

/** A string cut into chunks of at most `length` characters; at least one. */
export const chunked = (text: string, length: number = CHUNK_LENGTH): readonly string[] =>
  text.length === 0
    ? ['']
    : Array.from({ length: Math.ceil(text.length / length) }, (_, index) =>
        text.slice(index * length, (index + 1) * length)
      )

/** The plugin-data entries the document record is stored as. */
export const documentEntries = (record: DocumentRecord): readonly (readonly [string, string])[] => {
  const chunks = chunked(JSON.stringify({ variables: record.variables, exported: record.exported }))
  return [
    [DOCUMENT_KEY, String(chunks.length)],
    ...chunks.map((chunk, index) => [`${DOCUMENT_KEY}:${index}`, chunk] as const),
  ]
}

/** The document record a base board carries, or `undefined` when it carries none or a damaged one. */
export const readDocumentRecord = (node: PortBaseNode): DocumentRecord | undefined => {
  const count = Number(node.getPluginData(DOCUMENT_KEY))
  if (!Number.isInteger(count) || count < 1) return undefined
  const text = Array.from({ length: count }, (_, index) =>
    node.getPluginData(`${DOCUMENT_KEY}:${index}`)
  ).join('')
  const value = parsed(text)
  if (!isRecord(value)) return undefined
  const variables = value['variables']
  const stamp = decodeSafe(pageExportStampSchema)(value['exported'])
  if (!Array.isArray(variables) || !variables.every((entry) => typeof entry === 'string')) {
    return undefined
  }
  return stamp.success
    ? { variables: variables as readonly string[], exported: stamp.data }
    : undefined
}
