/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { S3AnswerError } from './s3-adapter'
import {
  passThrough,
  retryIdempotentS3,
  s3Deadline,
  S3_METADATA_TIMEOUT_MS,
} from './s3-call-policy'

/**
 * The S3 adapter's bucket listings, on Bun's `S3Client`: one bounded, retried
 * request per page, following the continuation token. Each function returns an
 * `Effect` whose error channel holds the peer's own rejection, as the rest of
 * the adapter (`s3-adapter.ts`) does.
 */

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
const s3ListRequest = (
  client: Bun.S3Client,
  bucket: string,
  options: Bun.S3ListObjectsOptions
): Effect.Effect<Bun.S3ListObjectsResponse, unknown> =>
  retryIdempotentS3(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
      Effect.tryPromise({ try: () => client.list(options, { bucket }), catch: passThrough }),
      s3Deadline('list', S3_METADATA_TIMEOUT_MS)
    )
  )

/** A listing that cannot end: a store handing back a page token it already gave. */
const repeatedPageToken = (bucket: string): S3AnswerError =>
  new S3AnswerError({ message: `s3 list for bucket "${bucket}" repeated its page token` })

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
const s3ListAll = (
  client: Bun.S3Client,
  bucket: string,
  input: { readonly prefix?: string; readonly maxPages: number }
): Effect.Effect<S3ListingPage, unknown> =>
  Effect.gen(function* () {
    const items: { readonly key: string; readonly size: number }[] = []
    const seen = new Set<string>()
    let token: string | undefined = undefined
    for (let pagesLeft = input.maxPages; ; pagesLeft -= 1) {
      const response: Bun.S3ListObjectsResponse = yield* s3ListRequest(client, bucket, {
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
      if (seen.has(next)) return yield* repeatedPageToken(bucket)
      if (pagesLeft <= 1) return { items, truncated: true }
      seen.add(next)
      token = next
    }
  })

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
export const s3ListPage = (
  client: Bun.S3Client,
  bucket: string,
  input: { readonly prefix: string; readonly after: string | undefined; readonly size: number }
): Effect.Effect<
  { readonly keys: readonly string[]; readonly after: string | undefined },
  unknown
> =>
  Effect.gen(function* () {
    const seen = new Set<string>()
    let token: string | undefined = undefined
    for (let pagesLeft = MAX_LIST_PAGES; ; pagesLeft -= 1) {
      const response: Bun.S3ListObjectsResponse = yield* s3ListRequest(
        client,
        bucket,
        pageRequest(input, token)
      )
      const keys = listedItems(response).map((item) => item.key)
      const next = response.nextContinuationToken
      if (keys.length > 0 || !response.isTruncated || !next) {
        return { keys, after: response.isTruncated && keys.length > 0 ? keys.at(-1) : undefined }
      }
      if (seen.has(next)) return yield* repeatedPageToken(bucket)
      if (pagesLeft <= 1) {
        return yield* new S3AnswerError({
          message: `s3 list for bucket "${bucket}" answered ${MAX_LIST_PAGES} empty pages`,
        })
      }
      seen.add(next)
      token = next
    }
  })

/**
 * EVERY object key under `prefix`: the walk follows the continuation token to
 * the last page, each page bounded and retried. A caller filters the listing
 * after it is read (a hand-started run keeps only the keys its starter may
 * reach), so a window cut before that filter could hide what sorts after the
 * keys it leaves out; `truncated` is therefore always `false`.
 */
export const s3List = (
  client: Bun.S3Client,
  bucket: string,
  prefix: string
): Effect.Effect<{ readonly keys: readonly string[]; readonly truncated: boolean }, unknown> =>
  s3ListAll(client, bucket, { prefix, maxPages: Infinity }).pipe(
    Effect.map((page) => ({ keys: page.items.map((item) => item.key), truncated: page.truncated }))
  )

/**
 * Sum object sizes across the whole bucket, following the continuation token.
 * Used for `STORAGE_MAX_TOTAL_SIZE` on the S3 provider and for the footprint
 * dashboard's bucket row.
 *
 * `truncated` is `true` when the walk stopped at {@link MAX_LIST_PAGES}; the
 * byte count is then a LOWER BOUND, and the caller is expected to say so
 * rather than present it as the total.
 */
export const s3GetTotalBytes = (
  client: Bun.S3Client,
  bucket: string
): Effect.Effect<{ readonly bytes: number; readonly truncated: boolean }, unknown> =>
  s3ListAll(client, bucket, { maxPages: MAX_LIST_PAGES }).pipe(
    Effect.map((page) => ({
      bytes: page.items.reduce((sum, item) => sum + item.size, 0),
      truncated: page.truncated,
    }))
  )
