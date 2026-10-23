/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure half of a bubble's link previews (`linkPreviews: true`): which
 * stored fields hold addresses worth reading, the addresses a text holds, the
 * one spelling an address is cached under, and the card fields a page's head
 * yields. No I/O: the read itself is the server's, through the guarded egress.
 */

import { LINK_PREVIEW_FIELD_MAX_LENGTH } from '@/domain/models/api/tables/link-previews'

/** The most addresses one message is read for: a pasted list of links is not a set of cards. */
export const LINK_PREVIEW_MAX_ADDRESSES = 5

/** An http or https address in running text, up to the first space or angle bracket. */
const ADDRESS = /\bhttps?:\/\/[^\s<>"']+/gi

/** Punctuation that closes a sentence rather than the address it follows. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/

/**
 * The one spelling an address is read and cached under: the scheme and host
 * lower-cased, the default port and the fragment dropped. `undefined` for
 * anything that is not an http or https address.
 */
export function normalizeLinkAddress(raw: string): string | undefined {
  const parsed = URL.parse(raw)
  if (parsed === null || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return undefined
  }
  const port =
    parsed.port === '' ||
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
      ? ''
      : `:${parsed.port}`
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${port}${parsed.pathname}${parsed.search}`
}

/** The distinct addresses a text holds, normalised, in the order they appear — at most five. */
export function linkAddressesIn(text: unknown): readonly string[] {
  if (typeof text !== 'string') return []
  const found = (text.match(ADDRESS) ?? [])
    .map((match) => normalizeLinkAddress(match.replace(TRAILING_PUNCTUATION, '')))
    .filter((address): address is string => address !== undefined)
  return [...new Set(found)].slice(0, LINK_PREVIEW_MAX_ADDRESSES)
}

/** The fields of a page's head a card is drawn from. */
export interface PreviewHead {
  readonly title: string | undefined
  readonly description: string | undefined
  readonly siteName: string | undefined
  readonly image: string | undefined
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** A head value as text: its character references read, its whitespace collapsed. */
const decodeText = (raw: string): string =>
  raw
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim()

/** Each `<meta>` of the head, by its `property` or `name`, lower-cased. */
const metaTags = (html: string): ReadonlyMap<string, string> =>
  new Map(
    (html.match(/<meta\b[^>]*>/gi) ?? []).flatMap((tag) => {
      const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
      const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag)
      const value = content?.[1] ?? content?.[2]
      return key === undefined || value === undefined ? [] : [[key.toLowerCase(), value] as const]
    })
  )

/** A value cut to its cap, `undefined` when empty. */
const capped = (value: string | undefined, max: number): string | undefined => {
  const text = value === undefined ? '' : decodeText(value)
  return text === '' ? undefined : text.slice(0, max)
}

/**
 * The card fields of a page: Open Graph first, then the plain `<title>` and
 * `<meta name=description>`. Read as TEXT — every value decoded and capped,
 * never markup — from the head the server read.
 */
export function parsePreviewHead(html: string): PreviewHead {
  const meta = metaTags(html)
  const title = meta.get('og:title') ?? /<title\b[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]
  const description = meta.get('og:description') ?? meta.get('description')
  return {
    title: capped(title, LINK_PREVIEW_FIELD_MAX_LENGTH.title),
    description: capped(description, LINK_PREVIEW_FIELD_MAX_LENGTH.description),
    siteName: capped(meta.get('og:site_name'), LINK_PREVIEW_FIELD_MAX_LENGTH.siteName),
    image: capped(meta.get('og:image') ?? meta.get('og:image:url'), 2048),
  }
}

/** A page component, as far as the walk below reads it. */
interface WalkedNode {
  readonly type?: unknown
  readonly content?: unknown
  readonly linkPreviews?: unknown
  readonly dataSource?: { readonly table?: unknown }
  readonly children?: unknown
}

const RECORD_FIELD = /^\$record\.([A-Za-z_][A-Za-z0-9_]*)$/

/** The `$record.<field>` contents of the previewing bubbles under a node. */
const previewFieldsUnder = (node: unknown): readonly string[] => {
  if (node === null || typeof node !== 'object') return []
  const { type, content, linkPreviews, children } = node as WalkedNode
  const own =
    type === 'bubble' && linkPreviews === true && typeof content === 'string'
      ? [RECORD_FIELD.exec(content)?.[1]].filter((f): f is string => f !== undefined)
      : []
  return [...own, ...(Array.isArray(children) ? children.flatMap(previewFieldsUnder) : [])]
}

/** Every component of a page tree, depth first. */
const nodesOf = (nodes: unknown): readonly WalkedNode[] =>
  Array.isArray(nodes)
    ? nodes.flatMap((node) =>
        node !== null && typeof node === 'object'
          ? [node as WalkedNode, ...nodesOf((node as WalkedNode).children)]
          : []
      )
    : []

/**
 * The fields whose addresses are read when a record is stored, by table: the
 * `$record.<field>` content of every `bubble` with `linkPreviews: true` in the
 * turn template of a `message-scroller` bound to that table.
 */
export function linkPreviewFieldsOf(app: {
  readonly pages?: readonly { readonly components?: unknown }[]
}): ReadonlyMap<string, readonly string[]> {
  const pairs = (app.pages ?? []).flatMap((page) =>
    nodesOf(page.components)
      .filter((node) => node.type === 'message-scroller')
      .flatMap((frame) => {
        const table = frame.dataSource?.table
        if (typeof table !== 'string') return []
        return previewFieldsUnder({ children: frame.children }).map(
          (field) => [table, field] as const
        )
      })
  )
  return pairs.reduce<ReadonlyMap<string, readonly string[]>>((byTable, [table, field]) => {
    const known = byTable.get(table) ?? []
    return known.includes(field) ? byTable : new Map([...byTable, [table, [...known, field]]])
  }, new Map())
}

/** The addresses one stored record holds in its previewing fields, normalised and distinct. */
export function linkAddressesOfRecord(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[]
): readonly string[] {
  return [...new Set(fields.flatMap((field) => linkAddressesIn(record[field])))].slice(
    0,
    LINK_PREVIEW_MAX_ADDRESSES
  )
}
