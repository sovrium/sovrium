/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { Effect } from 'effect'
import { StorageError, storageObjectTooLarge } from '@/application/ports/services/storage-service'
import type { StoredObjectHash } from '@/application/ports/services/storage-service'

/** The bytes read so far, in a buffer grown by doubling and never past the cap. */
interface Gathered {
  readonly buffer: Uint8Array
  readonly total: number
}

/** `gathered` with `piece` appended, or `undefined` when it would pass `maxBytes`. */
const appendWithin = (
  gathered: Gathered,
  piece: Uint8Array,
  maxBytes: number
): Gathered | undefined => {
  const total = gathered.total + piece.byteLength
  if (total > maxBytes) return undefined
  const buffer =
    total <= gathered.buffer.length
      ? gathered.buffer
      : new Uint8Array(Math.min(maxBytes, Math.max(total, gathered.buffer.length * 2)))
  if (buffer !== gathered.buffer) buffer.set(gathered.buffer.subarray(0, gathered.total))
  buffer.set(piece, gathered.total)
  return { buffer, total }
}

/**
 * Read pieces from `reader` into `gathered` until the stream ends or the cap is
 * passed. A loop, not recursion, as in {@link hashStream}: each awaited piece is
 * appended and let go, so a long object keeps no chain of pending reads alive.
 */
const gatherWithin = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
  signal: AbortSignal | undefined,
  first: Gathered
): Promise<Gathered | undefined> => {
  let gathered = first
  for (;;) {
    const { done, value } = await reader.read()
    signal?.throwIfAborted()
    if (done) return gathered
    const next = appendWithin(gathered, value, maxBytes)
    if (next === undefined) {
      await reader.cancel().catch(() => undefined)
      return undefined
    }
    gathered = next
  }
}

/**
 * Read a stream of an object's bytes, at most `maxBytes` of them.
 *
 * The cap is held WHILE reading, piece by piece: the first piece that takes
 * the total past `maxBytes` cancels the stream and answers `undefined`, so an
 * object larger than the cap is never held in memory whole, whatever its size
 * and whether or not its size was known beforehand. `signal`, when it aborts,
 * cancels the stream too and rejects with its reason, so a deadline around the
 * read stops the transfer instead of leaving it running. A stream that fails
 * rejects with its own error.
 */
export const readStreamWithin = async (
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array | undefined> => {
  const reader = stream.getReader()
  const stop = (): void => {
    void reader.cancel(signal?.reason).catch(() => undefined)
  }
  signal?.addEventListener('abort', stop, { once: true })
  try {
    signal?.throwIfAborted()
    const first = { buffer: new Uint8Array(Math.min(maxBytes, 64 * 1024)), total: 0 }
    const gathered = await gatherWithin(reader, maxBytes, signal, first)
    if (gathered === undefined) return undefined
    const { buffer, total } = gathered
    return total === buffer.length ? buffer : buffer.slice(0, total)
  } catch (error) {
    stop()
    throw error
  } finally {
    signal?.removeEventListener('abort', stop)
  }
}

/**
 * A provider's bounded read as the port answers it: the bytes, a
 * `StorageObjectTooLarge` cause once `read` found more than `maxBytes`, or the
 * read's own failure.
 */
export const boundedDownload = (
  key: string,
  maxBytes: number,
  read: () => Promise<Uint8Array | undefined>
): Effect.Effect<Uint8Array, StorageError> =>
  Effect.tryPromise({ try: read, catch: (cause: unknown) => new StorageError({ cause }) }).pipe(
    Effect.filterOrFail(
      (bytes): bytes is Uint8Array => bytes !== undefined,
      () => new StorageError({ cause: storageObjectTooLarge(key, maxBytes) })
    ),
    Effect.withSpan('storage.bounded-download')
  )

/**
 * The length and SHA-256 of a stream of an object's bytes, hashed piece by
 * piece as they arrive: no piece is kept once it is hashed, so memory stays
 * constant whatever the object's size. `signal`, when it aborts, cancels the
 * stream and rejects with its reason; a stream that fails rejects with its own
 * error.
 */
export const hashStream = async (
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): Promise<StoredObjectHash> => {
  const reader = stream.getReader()
  const stop = (): void => {
    void reader.cancel(signal?.reason).catch(() => undefined)
  }
  signal?.addEventListener('abort', stop, { once: true })
  try {
    signal?.throwIfAborted()
    const hash = createHash('sha256')
    let size = 0
    // A loop, not recursion: each awaited piece is hashed and let go, so a long
    // object keeps no chain of pending reads alive.
    for (;;) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) return { size, sha256: hash.digest('hex') }
      hash.update(value)
      size += value.byteLength
    }
  } catch (error) {
    stop()
    throw error
  } finally {
    signal?.removeEventListener('abort', stop)
  }
}
