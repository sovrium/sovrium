/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { gunzipSync, inflateSync } from 'node:zlib'
import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'

/**
 * The body of a telemetry protocol request, read only once its sender is
 * known (`telemetry-ingest-handler.ts`), and never past the API body limit.
 *
 * Two sizes are capped, against the same `API_BODY_LIMIT_BYTES`:
 *
 * - the bytes on the wire, counted AS THEY ARRIVE, so a body sent without a
 *   `Content-Length` (chunked) is refused at the limit rather than held whole
 *   in memory first. The protocol paths sit outside `/api/tables/*`, the one
 *   group `hono/body-limit` guards, and `/v1/logs` outside `/api/*` entirely;
 * - the decoded bytes, which zlib stops producing at the limit, so a small
 *   gzip of zeros that would inflate to gigabytes is refused after allocating
 *   no more than the limit.
 */

/** The JSON API body limit when `API_BODY_LIMIT_BYTES` is unset (25 MiB). */
const DEFAULT_BODY_LIMIT_BYTES = 25 * 1024 * 1024

/** `API_BODY_LIMIT_BYTES`, or 25 MiB. */
export const ingestBodyLimitBytes = (): number =>
  parsePositiveIntEnv(process.env['API_BODY_LIMIT_BYTES']) ?? DEFAULT_BODY_LIMIT_BYTES

const ACCEPTED_ENCODINGS: ReadonlySet<string> = new Set([
  '',
  'identity',
  'gzip',
  'x-gzip',
  'deflate',
])

/** Why a body is refused: each maps to one HTTP answer. */
export type IngestBodyRefusal = 'unsupported-encoding' | 'too-large' | 'malformed'

export type IngestBody = { readonly bytes: Uint8Array } | { readonly refusal: IngestBodyRefusal }

/** Join chunks into one buffer. */
const concat = (chunks: readonly Uint8Array[], total: number): Uint8Array => {
  const joined = new Uint8Array(total)
  chunks.reduce((offset, chunk) => {
    joined.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return joined
}

/** Read `reader` to its end, or `undefined` once more than `limit` bytes arrived. */
const readChunks = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  limit: number,
  read: { readonly chunks: readonly Uint8Array[]; readonly total: number }
): Promise<Uint8Array | undefined> => {
  const { done, value } = await reader.read()
  if (done) return concat(read.chunks, read.total)
  const total = read.total + value.byteLength
  if (total > limit) {
    await reader.cancel()
    return undefined
  }
  return readChunks(reader, limit, { chunks: [...read.chunks, value], total })
}

/**
 * The bytes of `stream`, or `undefined` as soon as they exceed `limit`: the
 * stream is then cancelled and nothing past the limit is kept.
 */
export const readAtMost = (
  stream: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<Uint8Array | undefined> =>
  stream === null
    ? Promise.resolve(new Uint8Array(0))
    : readChunks(stream.getReader(), limit, { chunks: [], total: 0 })

/** Decode `bytes` by their content encoding, never producing more than `limit` bytes. */
export const decodeIngestBytes = (
  bytes: Uint8Array,
  encoding: string,
  limit: number
): IngestBody => {
  try {
    if (encoding === 'gzip' || encoding === 'x-gzip') {
      return { bytes: gunzipSync(bytes, { maxOutputLength: limit }) }
    }
    if (encoding === 'deflate') return { bytes: inflateSync(bytes, { maxOutputLength: limit }) }
    return { bytes }
  } catch (error) {
    // zlib refuses an output past `maxOutputLength` with a RangeError; any
    // other failure is a body that does not decompress.
    return { refusal: error instanceof RangeError ? 'too-large' : 'malformed' }
  }
}

/** The decoded body of `request`, or why it is refused. */
export const readIngestBody = async (request: Request, limit: number): Promise<IngestBody> => {
  const encoding = (request.headers.get('content-encoding') ?? '').trim().toLowerCase()
  if (!ACCEPTED_ENCODINGS.has(encoding)) return { refusal: 'unsupported-encoding' }
  if (Number(request.headers.get('content-length') ?? '0') > limit) return { refusal: 'too-large' }
  const raw = await readAtMost(request.body, limit)
  if (raw === undefined) return { refusal: 'too-large' }
  return decodeIngestBytes(raw, encoding, limit)
}
