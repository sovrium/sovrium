/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  passThrough,
  retryIdempotentS3,
  s3Deadline,
  S3_DATA_TIMEOUT_MS,
  S3_METADATA_TIMEOUT_MS,
} from './s3-call-policy'
import type { S3StorageEnvConfig } from '@/domain/models/process-env/storage/storage'

/**
 * The S3 provider runs on Bun's native `Bun.S3Client`, not on `@aws-sdk/client-s3`.
 *
 * Bun ships an S3 client in the runtime, so the AWS SDK was a dependency the
 * shipped binary carried purely to speak a protocol Bun already speaks. The
 * call shapes are not interchangeable — AWS is `client.send(new XCommand({...}))`
 * with PascalCase fields, Bun is `write`/`file`/`list`/`delete`/`presign` with
 * camelCase ones — so the behaviour of this module is pinned by
 * `s3-adapter.test.ts` and by `[internal ref]-*`, not by its types.
 *
 * `bucket` stays a per-call parameter rather than being baked into the client,
 * because every function here already took it and the callers pass a single
 * configured bucket anyway.
 */
export const createS3Client = (config: S3StorageEnvConfig): Bun.S3Client =>
  new Bun.S3Client({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
    // Inverted, not renamed: AWS asks whether to FORCE path style, Bun asks
    // whether to use virtual-hosted style. `STORAGE_S3_FORCE_PATH_STYLE=true`
    // is the documented MinIO switch and must keep producing path-style URLs.
    virtualHostedStyle: !config.forcePathStyle,
  })

/**
 * Refuse a key the client would send as a different one.
 *
 * Bun's client trims a leading or trailing `/` and rewrites `\\` as `/` before
 * signing, and leaves `.` / `..` segments for the endpoint, which some
 * S3-compatible stores normalise. Ownership is recorded against the literal
 * key, so any of those would let an unowned spelling replace an owned object.
 * Exported for the sizing probe, which addresses objects the same way.
 */
export const assertCanonicalS3Key = (key: string): void => {
  if (!isCanonicalStorageKey(key)) {
    throw new Error(`Invalid storage key "${key}": it does not name exactly one stored object`)
  }
}

/**
 * Parameters for {@link s3Upload}
 */
export interface S3UploadParams {
  readonly client: Bun.S3Client
  readonly bucket: string
  readonly key: string
  readonly content: Uint8Array
  readonly mimeType: string
}

export const s3Upload = async (params: S3UploadParams): Promise<void> => {
  const { client, bucket, key, content, mimeType } = params
  assertCanonicalS3Key(key)
  // No retry: a re-sent PUT after a lost response can write the object twice.
  await Effect.runPromise(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
      Effect.tryPromise({
        try: () => client.write(key, content, { bucket, type: mimeType }),
        catch: passThrough,
      }),
      s3Deadline('upload', S3_DATA_TIMEOUT_MS)
    )
  )
}

/** How long the signed `PUT` of a create-only write stays valid. */
const CREATE_ONLY_URL_SECONDS = 300

/** Whether the store holds an object at `key`, asked of the store itself. */
const s3Exists = (client: Bun.S3Client, bucket: string, key: string): Promise<boolean> =>
  Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.exists(key, { bucket }), catch: passThrough }),
        s3Deadline('exists', S3_METADATA_TIMEOUT_MS)
      )
    )
  )

/** The request a create-only write sends: a seam, so a test can play the store's answer. */
export type S3ConditionalPut = (url: string, init: Readonly<RequestInit>) => Promise<Response>

const sendConditionalPut: S3ConditionalPut = (url, init) =>
  withFetchTimeout(url, init, S3_DATA_TIMEOUT_MS)

/**
 * {@link s3Upload} that replaces nothing: `taken` when an object is stored at
 * `key`. Bun's client sends no conditional header, so the bytes go in a signed
 * `PUT` carrying `If-None-Match: *`, which S3 answers `412` (or `409` for a
 * concurrent conditional write) when the key holds an object. A store that
 * ignores the header would replace the object, so the key is also checked
 * just before the bytes are sent; on such a store the window between that
 * check and the write stays open.
 */
export const s3UploadCreateOnly = async (
  params: S3UploadParams,
  put: S3ConditionalPut = sendConditionalPut
): Promise<'written' | 'taken'> => {
  const { client, bucket, key, content, mimeType } = params
  assertCanonicalS3Key(key)
  if (await s3Exists(client, bucket, key)) return 'taken'
  const url = client.presign(key, { bucket, method: 'PUT', expiresIn: CREATE_ONLY_URL_SECONDS })
  // No retry, as for `s3Upload`: a re-sent PUT after a lost response would answer `taken`.
  const response = await put(url, {
    method: 'PUT',
    headers: { 'If-None-Match': '*', 'Content-Type': mimeType },
    body: content.slice(),
  })
  if (response.status === 412 || response.status === 409) return 'taken'
  if (!response.ok) {
    throw new Error(`s3 create-only write of "${key}" failed with HTTP ${response.status}`)
  }
  return 'written'
}

export const s3Delete = async (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Promise<void> => {
  assertCanonicalS3Key(key)
  // No retry. A DELETE is idempotent by the S3 spec, but a versioned bucket
  // turns a repeat into a second delete MARKER — so the safe-looking case is
  // the one that quietly differs, and a failed delete is better surfaced than
  // papered over.
  await Effect.runPromise(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
      Effect.tryPromise({
        try: () => client.delete(key, { bucket }),
        catch: passThrough,
      }),
      s3Deadline('delete', S3_METADATA_TIMEOUT_MS)
    )
  )
}

/** Keys returned per listing call. 1000 is the S3 API maximum. */
const LIST_PAGE_SIZE = 1000

/**
 * Hard ceiling on pages walked by one quota total, i.e. 100 000 objects.
 *
 * A bucket listing is paginated and truncates SILENTLY at `maxKeys`: read as one
 * page, a bucket with 1500 objects answers with 1000 and no indication that 500
 * were dropped — so `s3List` would under-report files and `s3GetTotalBytes`
 * would return a quota figure that could never trip its own limit. Following the continuation
 * token fixes the common case, but an unbounded loop turns a dashboard read
 * into an unbounded round-trip count against a remote endpoint.
 *
 * So: paginate, and STATE the truncation when the ceiling is reached. A bounded
 * number that admits it is a floor is usable; a silent one is not.
 */
const MAX_LIST_PAGES = 100

/**
 * One paginated listing pass over a bucket.
 *
 * `truncated` is `true` when {@link MAX_LIST_PAGES} was exhausted with more
 * pages still pending — the results are then a prefix of the bucket, not the
 * whole of it.
 */
interface S3ListingPage {
  readonly items: ReadonlyArray<{ readonly key: string; readonly size: number }>
  readonly truncated: boolean
}

/**
 * One listing request, bounded and retried PER PAGE, not per walk: a hundred
 * pages against a slow endpoint is slow but not stuck, and a deadline over the
 * whole walk would truncate a legitimately large bucket — the exact
 * silent-truncation failure `MAX_LIST_PAGES` exists to make visible.
 */
const s3ListRequest = (client: Bun.S3Client, bucket: string, options: Bun.S3ListObjectsOptions) =>
  Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.list(options, { bucket }), catch: passThrough }),
        s3Deadline('list', S3_METADATA_TIMEOUT_MS)
      )
    )
  )

/** The keyed entries of one listing response; an omitted `size` reads as zero, never `NaN`. */
const listedItems = (
  response: Bun.S3ListObjectsResponse
): readonly { readonly key: string; readonly size: number }[] =>
  (response.contents ?? [])
    .filter((item) => Boolean(item.key))
    .map((item) => ({ key: item.key, size: item.size ?? 0 }))

/**
 * Walk every listing page for `bucket`/`prefix`, up to `maxPages` (no ceiling
 * when it is `Infinity`).
 *
 * The bucket goes in `list`'s SECOND argument, which is the only place Bun
 * reads it from: a `bucket` passed inside the first (`S3ListObjectsOptions`)
 * argument is silently ignored and the client's default bucket is listed
 * instead — measured against a request-recording endpoint, not inferred from the types.
 */
const s3ListAll = async (
  client: Bun.S3Client,
  bucket: string,
  input: { readonly prefix?: string; readonly maxPages: number }
): Promise<S3ListingPage> => {
  const items: { readonly key: string; readonly size: number }[] = []
  const seen = new Set<string>()
  let token: string | undefined = undefined
  for (let pagesLeft = input.maxPages; ; pagesLeft -= 1) {
    const response = await s3ListRequest(client, bucket, {
      ...(input.prefix ? { prefix: input.prefix } : {}),
      maxKeys: LIST_PAGE_SIZE,
      ...(token ? { continuationToken: token } : {}),
    })
    // One array, each page appended in place: a long walk stays linear.
    // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: see above
    items.push(...listedItems(response))
    const next = response.nextContinuationToken
    if (!response.isTruncated || !next) return { items, truncated: false }
    // A walk with no page ceiling must still end: a store handing back ANY token
    // it already gave would be read forever, so it fails, as `s3ListPage` does.
    if (seen.has(next)) throw new Error(`s3 list for bucket "${bucket}" repeated its page token`)
    if (pagesLeft <= 1) return { items, truncated: true }
    seen.add(next)
    token = next
  }
}

/** The request for one page: after `after` at first, then on the store's continuation token. */
const pageRequest = (
  input: { readonly prefix: string; readonly after: string | undefined; readonly size: number },
  token: string | undefined
): Bun.S3ListObjectsOptions => {
  const base = {
    ...(input.prefix ? { prefix: input.prefix } : {}),
    maxKeys: Math.min(input.size, LIST_PAGE_SIZE),
  }
  if (token !== undefined) return { ...base, continuationToken: token }
  return input.after === undefined ? base : { ...base, startAfter: input.after }
}

/**
 * One page of the keys under `prefix`, in key order, after the key `after`
 * (`startAfter`), at most `size` of them; `after` is `undefined` on the last.
 *
 * A store may answer a page that is truncated yet holds no key; that page is
 * not the last, so the store's continuation token is followed until a page
 * holds a key or the store says the listing is complete. A token handed back
 * twice, or {@link MAX_LIST_PAGES} empty pages in a row, fails the listing.
 */
export const s3ListPage = async (
  client: Bun.S3Client,
  bucket: string,
  input: { readonly prefix: string; readonly after: string | undefined; readonly size: number }
): Promise<{ readonly keys: readonly string[]; readonly after: string | undefined }> => {
  const seen = new Set<string>()
  let token: string | undefined = undefined
  for (let pagesLeft = MAX_LIST_PAGES; ; pagesLeft -= 1) {
    const response = await s3ListRequest(client, bucket, pageRequest(input, token))
    const keys = listedItems(response).map((item) => item.key)
    const next = response.nextContinuationToken
    if (keys.length > 0 || !response.isTruncated || !next) {
      return { keys, after: response.isTruncated && keys.length > 0 ? keys.at(-1) : undefined }
    }
    if (seen.has(next)) throw new Error(`s3 list for bucket "${bucket}" repeated its page token`)
    if (pagesLeft <= 1) {
      throw new Error(`s3 list for bucket "${bucket}" answered ${MAX_LIST_PAGES} empty pages`)
    }
    seen.add(next)
    token = next
  }
}

/**
 * EVERY object key under `prefix`: the walk follows the continuation token to
 * the last page, each page bounded and retried. A caller filters the listing
 * after it is read (a hand-started run keeps only the keys its starter may
 * reach), so a window cut before that filter could hide what sorts after the
 * keys it leaves out; `truncated` is therefore always `false`.
 */
export const s3List = async (
  client: Bun.S3Client,
  bucket: string,
  prefix: string
): Promise<{ readonly keys: readonly string[]; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket, { prefix, maxPages: Infinity })
  return { keys: page.items.map((item) => item.key), truncated: page.truncated }
}

/**
 * Fail unless the configured bucket is reachable with the configured credentials.
 *
 * A one-key listing rather than a bucket HEAD: Bun exposes no bucket-level
 * HEAD, and a listing capped at `maxKeys: 1` is the cheapest request that still
 * fails for a missing bucket and for bad credentials alike. What matters to the
 * caller is unchanged — an unreachable bucket fails BOOT rather than surfacing
 * on the first upload. The rejection is left to propagate; `storage-service-live`
 * is what turns it into a `StorageError` naming the bucket.
 */
export const s3ValidateBucket = async (client: Bun.S3Client, bucket: string): Promise<void> => {
  await Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({
          try: () => client.list({ maxKeys: 1 }, { bucket }),
          catch: passThrough,
        }),
        s3Deadline('bucket probe', S3_METADATA_TIMEOUT_MS)
      )
    )
  )
}

/**
 * Sum object sizes across the whole bucket, following the continuation token.
 * Used for `STORAGE_MAX_TOTAL_SIZE` on the S3 provider and for the footprint
 * dashboard's bucket row.
 *
 * `truncated` is `true` when the walk stopped at {@link MAX_LIST_PAGES}; the
 * byte count is then a LOWER BOUND, and the caller is expected to say so
 * rather than present it as the total.
 */
export const s3GetTotalBytes = async (
  client: Bun.S3Client,
  bucket: string
): Promise<{ readonly bytes: number; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket, { maxPages: MAX_LIST_PAGES })
  return {
    bytes: page.items.reduce((sum, item) => sum + item.size, 0),
    truncated: page.truncated,
  }
}

/**
 * A time-limited URL that serves the object's bytes.
 *
 * `presign` is synchronous — signing is local arithmetic with no round trip —
 * but the function stays `async` so the port and its callers are untouched.
 *
 * NO DEADLINE, and that is not an omission. Its declared return type is
 * `string`, not `Promise<string>`: there is no network and nothing to time
 * out, so a wrapper here would be inert ceremony that reads as protection.
 * `sovrium/require-egress-timeout` counts `presign` among its S3 egress
 * methods and therefore still reports this site; the suppression stays
 * until `S3_EGRESS_METHODS` drops it, which is a change to `[internal ref]` and so
 * belongs to `[internal ref]`.
 */
export const s3GetSignedUrl = async (
  client: Bun.S3Client,
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> => {
  assertCanonicalS3Key(key)
  return client.presign(key, { bucket, expiresIn, method: 'GET' })
}
