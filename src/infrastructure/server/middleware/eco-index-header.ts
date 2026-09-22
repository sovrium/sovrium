/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hono middleware that attaches an `X-Eco-Index: A`..`G` header to every
 * response, computed from the response's transferred byte count using the
 * EcoIndex grading table (see `src/domain/models/env/eco-index-header.ts`).
 *
 * Gated by `ECO_INDEX_HEADER` (default `on`, eco-aligned). Operators opt
 * out by setting `ECO_INDEX_HEADER=off`.
 *
 * Per-response strategy:
 *   1. Resolve the toggle from `process.env` at REQUEST TIME (not boot
 *      cache). The eco overview docs explicitly call this out — operators
 *      can toggle `ECO_INDEX_HEADER` and see the panel change on the next
 *      request without restarting the server.
 *   2. Read `Content-Length` from the outgoing response. When it is present
 *      it is authoritative and cheap, so it wins.
 *   3. When it is ABSENT, measure the buffered body — but only for the
 *      textual content types in {@link BUFFERABLE_CONTENT_TYPES}, and never
 *      for an attachment download (see {@link isAttachmentDownload}).
 *   4. Grade the byte count via `gradeBytes` and attach the header.
 *   5. Record the grade in the in-memory tracker so the overview route can
 *      surface the most recent grade + cumulative count.
 *
 * ## `Content-Length` is usually ABSENT, and that is why step 3 exists
 *
 * This comment previously asserted the header was "always available because
 * `c.json()` populates `Content-Length`". That is false, and it is how a
 * defect survived in plain sight. Probed against Hono directly:
 *
 *   - `c.json()`  → `content-type: application/json`, NO `content-length`
 *   - `c.text()`  → NEITHER header
 *   - `c.html()`  → `content-type: text/html`, no `content-length`
 *   - `c.body(u8)`→ NO `content-length`
 *
 * Bun writes a truthful `Content-Length` onto the wire AFTER this middleware
 * has already graded, so the size a client sees is no evidence of what the
 * grader saw. With the fallback previously gated on `text/html` alone, every
 * JSON response — including the largest documents the API serves — graded on
 * `bytes = 0`, and `gradeBytes(0)` is `A`, the best grade in the table.
 *
 * ## Why the gate is an ALLOWLIST, and must stay one
 *
 * The tempting simplification is a denylist ("buffer everything except
 * `text/event-stream`"). It is wrong here, and the reason is concrete:
 * bucket file downloads (`src/presentation/api/routes/buckets.ts`, and its
 * signed-url sibling) return raw bytes with no `Content-Length`. Under a
 * denylist, grading a multi-megabyte download would read the whole file into
 * memory purely to compute a letter. An allowlist of content types that are
 * already complete in-memory strings by the time this runs cannot do that.
 *
 * The allowlist alone is NOT sufficient, which is why the gate has a second
 * half: a download's content-type is derived from the stored file, so an
 * uploaded `report.json` comes back as an allowlisted `application/json`.
 * `Content-Disposition` separates those downloads (and the table CSV/JSON
 * exports) from genuine API documents. Both halves are load-bearing; removing
 * either re-opens the memory regression.
 *
 * ## Known, deliberate limitation
 *
 * Responses OUTSIDE the allowlist — live streams (SSE) and binary downloads
 * — are still recorded as 0 bytes and therefore grade `A`. That is not fixed
 * and is deliberately out of scope: buffering a stream would consume it, and
 * buffering a download would hold it in memory. Threading a real byte count
 * through those paths needs a counting stream wrapper at the response layer,
 * not a wider gate here.
 */

import { gradeBytes, parseEcoIndexHeader } from '@/domain/models/process-env/eco/eco-index-header'
import { recordGradedResponse } from '@/infrastructure/process/eco-index-tracker'
import type { Context, MiddlewareHandler, Next } from 'hono'

const HEADER_NAME = 'X-Eco-Index'

/**
 * Content-type essences whose bodies are complete in-memory strings by the
 * time this middleware runs, and are therefore safe to buffer for grading
 * when `Content-Length` is absent.
 *
 * Deliberately an allowlist rather than a denylist — see the module comment.
 * Adding an entry here is a claim that responses of that type are never
 * streamed and never large binaries; do not add `application/octet-stream`,
 * `text/event-stream`, or any `image/*` / `video/*` type.
 */
const BUFFERABLE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'text/html',
  'text/plain',
  'text/css',
  'text/xml',
  'text/javascript',
  'application/json',
  'application/xml',
  'application/javascript',
])

/**
 * Whether a `Content-Type` header value names a bufferable textual type.
 *
 * Compares the ESSENCE only — the part before any `;` — so `charset=utf-8`
 * and other parameters do not defeat the match. Structured-suffix JSON media
 * types (`application/problem+json`, `application/vnd.x+json`, …) are
 * accepted by suffix rather than enumerated.
 */
const isBufferableContentType = (contentType: string): boolean => {
  const essence = contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  return BUFFERABLE_CONTENT_TYPES.has(essence) || essence.endsWith('+json')
}

/**
 * Whether a response is a file DOWNLOAD rather than an API document.
 *
 * Content-type alone is not a sufficient memory guard, because a download's
 * type is derived from the stored file: a user who uploads `report.json` gets
 * it back as `application/json` — an allowlisted type — with no
 * `Content-Length` (verified: `new Response(uint8array)` sets none). Buffering
 * that would read the whole file into memory to compute a letter, which is the
 * exact regression the allowlist exists to prevent.
 *
 * `Content-Disposition` is the reliable discriminator: in this codebase it is
 * set by bucket downloads (`routes/buckets.ts`, `routes/buckets/signed-urls.ts`)
 * and by table CSV/JSON exports (`routes/tables/export-handlers.ts`) — every
 * unbounded-size response family — and by no API document.
 */
const isAttachmentDownload = (c: Readonly<Context>): boolean =>
  c.res.headers.get('content-disposition') != undefined

/**
 * Resolve the toggle + grade for a finished response and attach the
 * `X-Eco-Index` header. Hoisted out of the middleware factory so the
 * `consistent-function-scoping` lint stays happy.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context type is mutable by library design
async function handleEcoIndexResponse(c: Context, next: Next): Promise<void> {
  await next()

  const mode = parseEcoIndexHeader(process.env as Readonly<Record<string, string | undefined>>)
  if (mode === 'off') return

  // Measure transferred bytes. Prefer the explicit `Content-Length` header:
  // when present it is authoritative and costs nothing. It is usually ABSENT
  // on Hono responses (see the module comment), so fall back to measuring the
  // buffered body — but only for the textual types in the allowlist, so a
  // streamed SSE response is never consumed and a large binary download is
  // never held in memory just to compute a letter.
  const contentLength = c.res.headers.get('content-length')
  // Hono `Headers.get()` returns the literal absence as `null` per the
  // web-standard Fetch API; treat `null` and `undefined` uniformly.
  const headerBytes = contentLength == undefined ? undefined : Number.parseInt(contentLength, 10)
  const contentType = c.res.headers.get('content-type') ?? ''
  const canBufferForGrade = isBufferableContentType(contentType) && !isAttachmentDownload(c)
  const bytes =
    headerBytes !== undefined && Number.isFinite(headerBytes)
      ? headerBytes
      : canBufferForGrade
        ? // `arrayBuffer().byteLength`, NOT `text().length`: the latter counts
          // UTF-16 code units, which under-counts every multi-byte payload —
          // a 3,008-byte UTF-8 document measured 1,508, a whole grade of error.
          await c.res
            .clone()
            .arrayBuffer()
            .then((body) => body.byteLength)
            .catch(() => 0)
        : 0
  const grade = gradeBytes(bytes)

  c.res.headers.set(HEADER_NAME, grade)
  // The tracker takes the byte count the grade was computed FROM, not just the
  // letter — so the dashboard's mean-bytes figure is the same quantity the
  // client's header was derived from, and cannot drift from it.
  recordGradedResponse(grade, bytes)
}

/**
 * Build the eco-index header middleware. Reads `process.env` at REQUEST
 * TIME so operator changes take effect without a server restart.
 */
export const ecoIndexHeaderMiddleware = (): MiddlewareHandler => handleEcoIndexResponse
