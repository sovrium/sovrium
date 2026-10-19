/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A URL of the app itself that serves a stored file, read back to that file.
 *
 * An upload from a URL usually brings new bytes into the run. A URL the app
 * serves one of its own files from does not: its bytes are that file's, and
 * the upload carries that file's standing (`run-written-files.ts`). Two shapes
 * are the app's:
 *
 * - a signed download link (`/api/buckets/<bucket>/signed?path=…&token=…`)
 *   whose token verifies under the app's signing secret and has not expired —
 *   whatever host it names, since only the app holds the secret;
 * - a bucket file URL (`/api/buckets/<bucket>/files/<key>`) whose key the
 *   storage catalogue records, in its collision form — on ANY host, since an
 *   app is reached on addresses its `BASE_URL` does not name (a second domain,
 *   a bare IP, an internal name). This fails closed: another instance's file
 *   URL whose key ours also records is judged by our key's standing.
 *
 * Anything else — a key the catalogue does not record, a token that does not
 * verify, an expired link — is foreign, and its bytes come in with the run. A
 * fetch is judged by the address it was sent to AND the one that finally
 * served it: a foreign URL that redirects to one of the app's files carries
 * that file's standing.
 *
 * Where this reading cannot be sure, the URL is the app's and lends no
 * standing it cannot prove: a files URL whose path holds an escape that does
 * not decode (the route decodes such a path piece by piece, which no lookup
 * here reproduces), and a key the catalogue could not answer for.
 */

import { Effect, Option } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
  UNATTRIBUTED_BUCKET,
  type StorageError,
} from '@/application/ports/services/storage-service'
import { verifiedDownloadBinding } from '@/application/use-cases/buckets/signed-download-binding'
import { decodeSegment, parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { logError } from '@/infrastructure/logging/logger'
import type { RunWrittenFiles } from './run-written-files'

const SIGNED_PATH = /^\/api\/buckets\/([^/]+)\/signed$/
const FILES_PATH = /^\/api\/buckets\/[^/]+\/files\/.+$/

/** `text` read as an http(s) URL; `undefined` for anything else. */
export const httpUrlOf = (text: string): Readonly<URL> | undefined => {
  try {
    const url = new URL(text)
    return /^https?:$/.test(url.protocol) ? url : undefined
  } catch {
    return undefined
  }
}

/** The key a signed download link the app minted names, while it is valid; else `undefined`. */
export const signedLinkKey = (url: Readonly<URL>, now: number): string | undefined => {
  const bucket = SIGNED_PATH.exec(url.pathname)?.[1]
  if (bucket === undefined) return undefined
  const query = Object.fromEntries(url.searchParams.entries())
  const { path, token } = query
  const expires = Number(query['expires'])
  if (!path || !token || !Number.isFinite(expires) || query['op'] === 'upload') return undefined
  if (now > expires) return undefined
  return verifiedDownloadBinding(query, { bucket: decodeSegment(bucket), path, expires }, token) ===
    undefined
    ? undefined
    : path
}

/** The key a bucket file URL names, decoded as the files route decodes it, on any host. */
export const filesUrlKey = (url: Readonly<URL>): string | undefined =>
  FILES_PATH.test(url.pathname) ? parseBucketFileUrl(url.pathname)?.key : undefined

/** Whether every escape in `path` decodes, so the route and this reading agree on its key. */
const decodesWhole = (path: string): boolean => {
  try {
    return decodeURIComponent(path).length >= 0
  } catch {
    return false
  }
}

/** A catalogue that could not answer for `key`: logged, and the key judged as the app's. */
const unanswered = (key: string, error: Readonly<StorageError>): Effect.Effect<string> =>
  Effect.sync(() => {
    logError('[automations] the storage catalogue could not say whether it records a key', error, {
      'sovrium.storage.key': key,
    })
    return key
  })

/**
 * The key the storage catalogue records for `key`: the key itself, or the
 * stored spelling the store folds it onto; `undefined` when it records
 * neither. A catalogue that cannot say answers `key` itself: the URL is then
 * judged as one of the app's, whose standing the run must prove.
 */
const cataloguedKey = (key: string): Effect.Effect<string | undefined, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const meta = yield* Effect.result(storage.getMetadata(key, UNATTRIBUTED_BUCKET))
    if (meta._tag === 'Success') return key
    if (!isStorageObjectNotFound(meta.failure)) return yield* unanswered(key, meta.failure)
    const other = yield* Effect.result(storage.findOtherSpelling(key))
    if (other._tag === 'Failure') return yield* unanswered(key, other.failure)
    return Option.isSome(other.success) ? other.success.value.key : undefined
  })

/** The stored key a URL of the app serves, or `undefined` for a foreign URL. */
export const ownStoredKeyOfUrl = (
  source: string
): Effect.Effect<string | undefined, never, StorageService> =>
  Effect.gen(function* () {
    const url = httpUrlOf(source)
    if (url === undefined) return undefined
    const signed = signedLinkKey(url, Date.now())
    if (signed !== undefined) return signed
    const key = filesUrlKey(url)
    if (key === undefined) return undefined
    // Read by the route piece by piece, so no lookup here can name its file: the app's.
    if (!decodesWhole(url.pathname)) return key
    return yield* cataloguedKey(key)
  }).pipe(Effect.withSpan('automations.own-stored-key-of-url'))

/**
 * Whether bytes fetched from `source` came in with the run: a foreign URL's
 * do; a URL of the app carries the standing of the file it serves. Judged on
 * `source` and on `fetchedFrom`, the address that served the bytes after any
 * redirect: each one of the app's must name a file whose bytes are the run's.
 */
export const fetchedUrlStanding = (
  written: RunWrittenFiles | undefined,
  source: string,
  fetchedFrom: string = source
): Effect.Effect<boolean, never, StorageService> =>
  Effect.map(Effect.forEach([...new Set([source, fetchedFrom])], ownStoredKeyOfUrl), (keys) =>
    keys.every((key) => key === undefined || written?.keyHasRunBytes(key) === true)
  ).pipe(Effect.withSpan('automations.fetched-url-standing'))

/**
 * The standing of an upload's `source`: a `data:` URI's bytes are the run's;
 * a stored key, and a URL of the app (as sent, or as redirected to), carry the
 * stored file's; a foreign URL's are the run's.
 */
export const uploadSourceStanding = (
  written: RunWrittenFiles | undefined,
  source: string,
  resolved: { readonly fromStore?: true; readonly fetchedFrom?: string }
): Effect.Effect<boolean, never, StorageService> =>
  Effect.gen(function* () {
    if (resolved.fromStore === true) return written?.keyHasRunBytes(source) === true
    return /^https?:\/\//.test(source)
      ? yield* fetchedUrlStanding(written, source, resolved.fetchedFrom)
      : true
  }).pipe(Effect.withSpan('automations.upload-source-standing'))
