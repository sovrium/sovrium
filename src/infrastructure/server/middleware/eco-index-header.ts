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
 *   2. Read `Content-Length` from the outgoing response. When the response
 *      omits `Content-Length` (e.g. SSE / streaming), measure the
 *      buffered body — for the JSON admin endpoints this is always
 *      available because `c.json()` populates `Content-Length`.
 *   3. Grade the byte count via `gradeBytes` and attach the header.
 *   4. Record the grade in the in-memory tracker so the overview route can
 *      surface the most recent grade + cumulative count.
 *
 * The middleware is registered globally so the header is consistently
 * present on every response shape (JSON admin, HTML page, SSE). The
 * `Content-Length` read covers the common cases; streaming responses without
 * a known length grade `A` (zero bytes counted at the response point — they
 * accumulate later); a future tier-2 PR could thread the actual byte count
 * through.
 */

import { gradeBytes, parseEcoIndexHeader } from '@/domain/models/env/eco/eco-index-header'
import { recordGradedResponse } from '@/infrastructure/utils/eco-index-tracker'
import type { Context, MiddlewareHandler, Next } from 'hono'

const HEADER_NAME = 'X-Eco-Index'

/**
 * Resolve the toggle + grade for a finished response and attach the
 * `X-Eco-Index` header. Hoisted out of the middleware factory so the
 * `consistent-function-scoping` lint stays happy.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context type is mutable by library design
async function handleEcoIndexResponse(c: Context, next: Next): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- middleware contract: invoke downstream
  await next()

  const mode = parseEcoIndexHeader(process.env as Readonly<Record<string, string | undefined>>)
  if (mode === 'off') return

  // Measure transferred bytes. Prefer the explicit Content-Length header
  // (`c.json()` and `c.text()` set it); fall back to measuring the
  // buffered body for `text/html` responses when the header is absent so
  // the grade reflects real bytes rather than `A` by default — important
  // for the low-data EcoIndex delta spec. Streaming responses (SSE) carry
  // `text/event-stream` and intentionally skip the body buffer so the
  // stream is not exhausted.
  const contentLength = c.res.headers.get('content-length')
  // Hono `Headers.get()` returns the literal absence as `null` per the
  // web-standard Fetch API; treat `null` and `undefined` uniformly.
  const headerBytes = contentLength == undefined ? undefined : Number.parseInt(contentLength, 10)
  const contentType = c.res.headers.get('content-type') ?? ''
  const canBufferForGrade = contentType.toLowerCase().includes('text/html')
  const bytes =
    headerBytes !== undefined && Number.isFinite(headerBytes)
      ? headerBytes
      : canBufferForGrade
        ? await c.res
            .clone()
            .text()
            .then((body) => body.length)
            .catch(() => 0)
        : 0
  const grade = gradeBytes(bytes)

  c.res.headers.set(HEADER_NAME, grade)
  recordGradedResponse(grade)
}

/**
 * Build the eco-index header middleware. Reads `process.env` at REQUEST
 * TIME so operator changes take effect without a server restart.
 */
export const ecoIndexHeaderMiddleware = (): MiddlewareHandler => handleEcoIndexResponse
