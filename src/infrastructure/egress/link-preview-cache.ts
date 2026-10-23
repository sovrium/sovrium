/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The link previews the server has read, by normalised address.
 *
 * A page is read when a record holding its address is STORED — never because
 * a reader asked, and never for an address a reader sends. The read goes
 * through the guarded egress with the resolver check on, on the address and on
 * every redirect hop; keeps at most the first 256 KB of an HTML answer; and
 * keeps of it only the card fields, as text. The page's picture is read once
 * too ({@link fetchRemoteImage}) and served by the app.
 *
 * A read is reused for 24 hours and a failure remembered for one, so one page
 * posted in many messages — under any spelling of its address — is read once.
 * Process state, bounded by count; a restart forgets it, and the next stored
 * record holding the address reads it again.
 */

import { createHash } from 'node:crypto'
import {
  LINK_PREVIEW_FAILURE_TTL_SECONDS,
  LINK_PREVIEW_HEAD_MAX_BYTES,
  LINK_PREVIEW_IMAGE_MAX_BYTES,
  LINK_PREVIEW_TTL_SECONDS,
} from '@/domain/models/api/tables/link-previews'
import { parsePreviewHead } from '@/domain/models/app/pages/components/component-types/display/link-preview-service'
import { guardedFetch, guardedText } from './guarded-fetch'
import { systemResolveHost } from './host-resolution'
import { fetchRemoteImage, keptRemoteImage, type RemoteImage } from './remote-media'

/** One read page, as a card. @public */
export interface CachedLinkPreview {
  readonly id: string
  readonly url: string
  readonly title: string | undefined
  readonly description: string | undefined
  readonly siteName: string | undefined
  /** True when the page's picture was read and is kept, so the app can serve it. */
  readonly hasImage: boolean
  readonly fetchedAt: string
}

type Entry =
  | {
      readonly at: number
      readonly ok: true
      readonly card: Omit<CachedLinkPreview, 'hasImage'>
      readonly image: string | undefined
    }
  | { readonly at: number; readonly ok: false }

/** The most addresses remembered at once. */
const MAX_ENTRIES = 10_000

/** How long one read of a page or of its picture may take, in milliseconds. */
const READ_TIMEOUT_MS = 10_000

const entries = new Map<string, Entry>()
const inFlight = new Map<string, Promise<void>>()

/** The id of a card: the SHA-256 of its normalised address, in lower-case hex. @public */
export const previewIdOf = (address: string): string =>
  createHash('sha256').update(address).digest('hex')

const isFresh = (entry: Entry | undefined): boolean => {
  if (entry === undefined) return false
  const ttlSeconds = entry.ok ? LINK_PREVIEW_TTL_SECONDS : LINK_PREVIEW_FAILURE_TTL_SECONDS
  return Date.now() - entry.at < ttlSeconds * 1000
}

const remember = (address: string, entry: Entry): void => {
  entries.delete(address)
  entries.set(address, entry)
  if (entries.size <= MAX_ENTRIES) return
  const oldest = entries.keys().next().value
  if (oldest !== undefined) entries.delete(oldest)
}

const isHtml = (contentType: string | null): boolean => {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  return type === 'text/html' || type === 'application/xhtml+xml'
}

/** The page's picture as an absolute http(s) address, read against the page that named it. */
const pictureAddressOf = (named: string | undefined, page: string): string | undefined => {
  const image = named === undefined ? null : URL.parse(named, page)
  return image?.protocol === 'https:' || image?.protocol === 'http:' ? image.href : undefined
}

/** Read one page and its picture now, and remember the card or the failure. */
const readPage = async (address: string): Promise<void> => {
  const failed = (): void => remember(address, { at: Date.now(), ok: false })
  try {
    const sent = await guardedFetch(
      address,
      { headers: { Accept: 'text/html,application/xhtml+xml' } },
      {
        timeoutMs: READ_TIMEOUT_MS,
        maxBodyBytes: LINK_PREVIEW_HEAD_MAX_BYTES,
        resolveHost: systemResolveHost,
      }
    )
    if (!sent.ok || !sent.response.ok || !isHtml(sent.response.headers.get('content-type'))) {
      return failed()
    }
    const head = parsePreviewHead(guardedText(sent.response))
    const imageAddress = pictureAddressOf(head.image, sent.response.url)
    if (imageAddress !== undefined) {
      await fetchRemoteImage(imageAddress, {
        maxBytes: LINK_PREVIEW_IMAGE_MAX_BYTES,
        timeoutMs: READ_TIMEOUT_MS,
        ttlMs: LINK_PREVIEW_TTL_SECONDS * 1000,
        failureTtlMs: LINK_PREVIEW_FAILURE_TTL_SECONDS * 1000,
      })
    }
    const now = new Date()
    remember(address, {
      at: now.getTime(),
      ok: true,
      image: imageAddress,
      card: {
        id: previewIdOf(address),
        url: address,
        title: head.title,
        description: head.description,
        siteName: head.siteName,
        fetchedAt: now.toISOString(),
      },
    })
  } catch {
    // A transport failure (DNS, TLS, the deadline) is the page's answer for an
    // hour, as a refusal is: the next stored record holding it reads it again.
    failed()
  }
}

/**
 * Read every address not read recently. Resolves when the reads are over;
 * an address being read is read once however many records ask for it.
 *
 * @public
 */
export const readLinkPreviews = async (addresses: readonly string[]): Promise<void> => {
  await Promise.all(
    addresses.map((address) => {
      if (isFresh(entries.get(address))) return Promise.resolve()
      const running = inFlight.get(address)
      if (running !== undefined) return running
      const read = readPage(address).finally(() => inFlight.delete(address))
      inFlight.set(address, read)
      return read
    })
  )
}

/** The cards of the addresses that were read successfully, in their order. Reads nothing. @public */
export const cachedLinkPreviews = (addresses: readonly string[]): readonly CachedLinkPreview[] =>
  addresses.flatMap((address) => {
    const entry = entries.get(address)
    if (entry === undefined || !entry.ok) return []
    const hasImage = entry.image !== undefined && keptRemoteImage(entry.image) !== undefined
    return [{ ...entry.card, hasImage }]
  })

/** The kept picture of the card `previewId`, when it is one of `addresses`. Reads nothing. @public */
export const linkPreviewPicture = (
  addresses: readonly string[],
  previewId: string
): RemoteImage | undefined => {
  const address = addresses.find((candidate) => previewIdOf(candidate) === previewId)
  const entry = address === undefined ? undefined : entries.get(address)
  return entry?.ok === true && entry.image !== undefined ? keptRemoteImage(entry.image) : undefined
}
