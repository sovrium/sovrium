/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { BUNDLE_MAX_UNPACKED_BYTES, gunzipBounded } from '@/domain/kernel/format/bounded-gunzip'

/**
 * Read a stored bundle into its entries, never unpacking more than
 * {@link BUNDLE_MAX_UNPACKED_BYTES}: the gzip layer is inflated against that
 * cap (`gunzipBounded`) before the tar is read, so a small upload that expands
 * a thousandfold is refused instead of exhausting memory.
 */

/** What reading a stored bundle produced. */
export type BundleArchiveReading =
  | { readonly kind: 'entries'; readonly entries: ReadonlyMap<string, Uint8Array> }
  | { readonly kind: 'not-an-archive' }
  | { readonly kind: 'too-large' }

/** The inflated bytes could not be read as a tar. */
class NotAnArchive extends Data.TaggedError('NotAnArchive')<{ readonly cause: unknown }> {}

/** Every entry of an inflated tar, path → bytes, read one after another. */
const tarEntries = async (tar: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> => {
  const files = await new Bun.Archive(tar).files()
  const pairs = await [...files].reduce<Promise<readonly (readonly [string, Uint8Array])[]>>(
    async (read, [path, file]) => [
      ...(await read),
      [path, new Uint8Array(await file.arrayBuffer())],
    ],
    Promise.resolve([])
  )
  return new Map(pairs)
}

/**
 * Read a stored bundle — a tar.gz written by `sovrium bundle` — into its
 * entries, refusing one that unpacks past `cap`. Bytes that are not a gzipped
 * tar are a verdict about the upload (`not-an-archive`), never a fault.
 */
export const readBundleArchive = (
  bytes: Uint8Array,
  cap: number = BUNDLE_MAX_UNPACKED_BYTES
): Effect.Effect<BundleArchiveReading> => {
  const inflated = gunzipBounded(bytes, cap)
  if (inflated._tag === 'TooLarge') return Effect.succeed({ kind: 'too-large' })
  if (inflated._tag === 'NotGzip') return Effect.succeed({ kind: 'not-an-archive' })
  return Effect.tryPromise({
    try: async (): Promise<BundleArchiveReading> => ({
      kind: 'entries',
      entries: await tarEntries(inflated.bytes),
    }),
    catch: (cause) => new NotAnArchive({ cause }),
  }).pipe(
    Effect.tapCause((cause) => Effect.logDebug('bundle: the object is not an archive', cause)),
    // Bytes that are not an archive are a verdict about the upload, not a fault.
    Effect.orElseSucceed((): BundleArchiveReading => ({ kind: 'not-an-archive' })),
    Effect.withSpan('server.read-bundle-archive')
  )
}
