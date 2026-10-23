/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure half of a composer's GIF picker (`form.gif`): which connections a
 * page's composer names, and the provider's answer read into ONE shape. No
 * I/O: the search and the media reads are the server's.
 */

/** The most results a search answers. */
export const GIF_SEARCH_MAX_RESULTS = 24

/** A GIF id as the media route accepts it — what GIPHY's ids are made of, nothing to traverse. */
export const GIF_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/** One rendition's address. */
export interface GifRendition {
  readonly url: string
  readonly width: number
  readonly height: number
}

/** One result as the provider described it. */
export interface GifPick {
  readonly id: string
  readonly title: string
  readonly original: GifRendition
  readonly preview: GifRendition
}

interface WalkedNode {
  readonly type?: unknown
  readonly presentation?: unknown
  readonly gif?: { readonly connection?: unknown; readonly provider?: unknown }
  readonly children?: unknown
}

const nodesOf = (nodes: unknown): readonly WalkedNode[] =>
  Array.isArray(nodes)
    ? nodes.flatMap((node) =>
        node !== null && typeof node === 'object'
          ? [node as WalkedNode, ...nodesOf((node as WalkedNode).children)]
          : []
      )
    : []

/**
 * The connections a composer on some page names as its `gif.connection`, with
 * the provider each reads. Only these answer the GIF routes: they are not a way
 * to call any other connection.
 */
export function composerGifConnectionsOf(app: {
  readonly pages?: readonly { readonly components?: unknown }[]
}): ReadonlyMap<string, 'giphy'> {
  return new Map(
    (app.pages ?? []).flatMap((page) =>
      nodesOf(page.components).flatMap((node) =>
        node.type === 'form' &&
        node.presentation === 'composer' &&
        typeof node.gif?.connection === 'string'
          ? [[node.gif.connection, 'giphy'] as const]
          : []
      )
    )
  )
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

/** A GIPHY rendition: its http(s) address and its size, which GIPHY spells as text. */
const giphyRendition = (value: unknown): GifRendition | undefined => {
  const rendition = asRecord(value)
  const url = rendition?.['url']
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return undefined
  const size = (key: string): number => {
    const parsed = Number(rendition?.[key])
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
  }
  return { url, width: size('width'), height: size('height') }
}

/** The renditions of one GIPHY result: the full GIF, and the small one the grid draws. */
const giphyRenditions = (
  images: Readonly<Record<string, unknown>> | undefined
): { readonly original: GifRendition; readonly preview: GifRendition } | undefined => {
  const original = giphyRendition(images?.['original'])
  if (original === undefined) return undefined
  const preview =
    giphyRendition(images?.['fixed_width']) ?? giphyRendition(images?.['fixed_width_small'])
  return { original, preview: preview ?? original }
}

/** A result's title as its alternative text, `GIF` when it has none. */
const giphyTitle = (title: unknown): string =>
  typeof title === 'string' && title !== '' ? title.slice(0, 200) : 'GIF'

/** One GIPHY result, or `undefined` when it lacks an id or a usable rendition. */
const giphyPick = (value: unknown): GifPick | undefined => {
  const item = asRecord(value)
  const id = item?.['id']
  const renditions = giphyRenditions(asRecord(item?.['images']))
  if (typeof id !== 'string' || !GIF_ID_PATTERN.test(id) || renditions === undefined) {
    return undefined
  }
  return { id, title: giphyTitle(item?.['title']), ...renditions }
}

/**
 * GIPHY's answer — to a search (`data` a list) or to one GIF (`data` an
 * object) — read into picks, in its order, at most {@link GIF_SEARCH_MAX_RESULTS}.
 * Anything else in the answer is dropped here, so nothing of it reaches a page.
 */
export function readGiphyAnswer(body: unknown): readonly GifPick[] {
  const data = asRecord(body)?.['data']
  const items = Array.isArray(data) ? data : data === undefined ? [] : [data]
  return items
    .map(giphyPick)
    .filter((pick): pick is GifPick => pick !== undefined)
    .slice(0, GIF_SEARCH_MAX_RESULTS)
}
