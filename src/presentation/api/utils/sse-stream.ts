/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const SSE_HEARTBEAT_INTERVAL_MS = 15_000

export const SSE_STREAM_MAX_LIFETIME_MS = 25_000

export const SSE_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

const ENCODER = new TextEncoder()

export const encodeSseMessage = (message: Record<string, unknown>): string =>
  `data: ${JSON.stringify(message)}\n\n`

export const enqueueSseMessage = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: Record<string, unknown>
): void => controller.enqueue(ENCODER.encode(encodeSseMessage(message)))
