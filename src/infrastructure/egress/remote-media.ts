/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A picture of another site, fetched ONCE by the server and served by the app,
 * so a reader's browser never contacts that site: a link preview's cover, a
 * GIF and its thumbnail.
 *
 * Every read goes through the guarded egress with the resolver check on, on
 * the address and on every redirect hop; keeps only a raster picture type
 * (never SVG: a picture served from the app's own origin must not be able to
 * run script); and refuses one past its size cap rather than keeping the start of
 * it. Answers — a picture or a refusal — are kept in memory, by address, in a
 * cache bounded in bytes that forgets the oldest first, and one address being
 * read is read once however many ask for it meanwhile.
 *
 * Process state, like the realtime channels: a restart forgets it, and the
 * next ask reads again.
 */

import { guardedFetch } from './guarded-fetch'
import { systemResolveHost, type ResolveHost } from './host-resolution'

/** A picture as the app serves it. @public */
export interface RemoteImage {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/** A read: the picture, or why there is none. @public */
export type RemoteImageResult =
  | { readonly ok: true; readonly image: RemoteImage }
  | { readonly ok: false; readonly reason: string }

/** How one address is read and how long its answer is kept. @public */
export interface RemoteImageOptions {
  readonly maxBytes: number
  readonly timeoutMs: number
  /** How long a picture is reused, in milliseconds. */
  readonly ttlMs: number
  /** How long a refusal or a failure is remembered, in milliseconds. */
  readonly failureTtlMs: number
  /** The resolver the guard asks; the machine's own by default. */
  readonly resolveHost?: ResolveHost
}

/**
 * The picture types kept and served: raster formats a browser draws and never
 * runs. SVG — and any type not listed — is refused, so nothing served from the
 * app's origin can carry script.
 */
const PICTURE_TYPES: ReadonlySet<string> = new Set([
  'image/avif',
  'image/webp',
  'image/gif',
  'image/png',
  'image/apng',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

/** The most bytes of pictures held at once, every address together. */
const CACHE_MAX_BYTES = 64 * 1024 * 1024

interface Entry {
  readonly at: number
  readonly result: RemoteImageResult
}

const cache = new Map<string, Entry>()
const inFlight = new Map<string, Promise<RemoteImageResult>>()
let cachedBytes = 0

const sizeOf = (result: RemoteImageResult): number =>
  result.ok ? result.image.bytes.byteLength : 0

const forget = (address: string): void => {
  const entry = cache.get(address)
  if (entry === undefined) return
  cachedBytes -= sizeOf(entry.result)
  cache.delete(address)
}

/** Keep an answer, the oldest ones leaving first once the byte budget is spent. */
const remember = (address: string, result: RemoteImageResult): void => {
  forget(address)
  cache.set(address, { at: Date.now(), result })
  cachedBytes += sizeOf(result)
  for (const oldest of cache.keys()) {
    if (cachedBytes <= CACHE_MAX_BYTES || oldest === address) break
    forget(oldest)
  }
}

/** The kept answer of an address, still fresh, or `undefined`. */
const fresh = (address: string, options: RemoteImageOptions): RemoteImageResult | undefined => {
  const entry = cache.get(address)
  if (entry === undefined) return undefined
  const ttl = entry.result.ok ? options.ttlMs : options.failureTtlMs
  return Date.now() - entry.at < ttl ? entry.result : undefined
}

/** An answer's media type, without its parameters, lower-cased. */
const mediaTypeOf = (header: string | null): string =>
  (header ?? '').split(';')[0]?.trim().toLowerCase() ?? ''

const refused = (reason: string): RemoteImageResult => ({ ok: false, reason })

/** Read one address now, through the guard. Never rejects: a failure is a result. */
const readImage = async (
  address: string,
  options: RemoteImageOptions
): Promise<RemoteImageResult> => {
  try {
    const sent = await guardedFetch(
      address,
      { headers: { Accept: 'image/avif,image/webp,image/gif,image/png,image/jpeg,image/*' } },
      {
        timeoutMs: options.timeoutMs,
        maxBodyBytes: options.maxBytes,
        resolveHost: options.resolveHost ?? systemResolveHost,
      }
    )
    if (!sent.ok) return refused(sent.message)
    const { response } = sent
    if (!response.ok) return refused(`HTTP ${String(response.status)}`)
    if (response.truncated) return refused('larger than the size cap')
    const contentType = mediaTypeOf(response.headers.get('content-type'))
    if (!PICTURE_TYPES.has(contentType)) {
      return refused(`not a picture (${contentType || 'no type'})`)
    }
    return { ok: true, image: { bytes: response.body, contentType } }
  } catch (error) {
    return refused(error instanceof Error ? error.message : String(error))
  }
}

/**
 * The picture at `address`: the kept one while fresh, else read once — a
 * second ask during the read waits for the same read.
 *
 * @public
 */
export const fetchRemoteImage = (
  address: string,
  options: RemoteImageOptions
): Promise<RemoteImageResult> => {
  const kept = fresh(address, options)
  if (kept !== undefined) return Promise.resolve(kept)
  const running = inFlight.get(address)
  if (running !== undefined) return running
  const read = readImage(address, options).then((result) => {
    remember(address, result)
    inFlight.delete(address)
    return result
  })
  inFlight.set(address, read)
  return read
}

/** The kept picture of `address`, fresh or not, without reading anything. @public */
export const keptRemoteImage = (address: string): RemoteImage | undefined => {
  const entry = cache.get(address)
  return entry?.result.ok === true ? entry.result.image : undefined
}
