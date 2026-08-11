/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared Server-Sent Events stream primitives for the realtime endpoints.
 *
 * Both the table-change subscription endpoint (`subscribe-handlers.ts`) and
 * the presence-awareness endpoint (`realtime/presence-handlers.ts`) open SSE
 * streams with an identical wire encoding, heartbeat cadence, and bounded
 * lifetime. This module is the single source of truth for those constants and
 * the `data:`-line encoder so the two endpoints cannot drift apart.
 */

/** Heartbeat cadence on an open realtime SSE connection. */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000

/**
 * Maximum lifetime of a single realtime SSE connection. The stream closes
 * itself after this window; browser `EventSource` clients auto-reconnect, and
 * `fetch`-based callers (Playwright `request.get`) get a clean, terminating
 * response body instead of an indefinitely-open stream.
 */
export const SSE_STREAM_MAX_LIFETIME_MS = 25_000

/** Standard response headers for a `text/event-stream` SSE response. */
export const SSE_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

const ENCODER = new TextEncoder()

/** Encode a realtime message object as a single SSE `data:` event line. */
export const encodeSseMessage = (message: Record<string, unknown>): string =>
  `data: ${JSON.stringify(message)}\n\n`

/** Enqueue a realtime message onto an SSE stream controller as a `data:` line. */
export const enqueueSseMessage = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: Record<string, unknown>
): void => controller.enqueue(ENCODER.encode(encodeSseMessage(message)))
