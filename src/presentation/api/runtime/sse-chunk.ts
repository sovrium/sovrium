/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One chunk as it appears on the SSE wire.
 *
 * - `data`: a JSON object rendered as `data: <json>\n\n`, under an
 *   `event: <name>` line when the chunk names its event type (the chat
 *   stream's typed events do; the subscribe/presence streams do not).
 * - `terminal`: the literal `data: [DONE]\n\n` sentinel from OpenAI's
 *   streaming protocol. Only the AI chat-stream uses `terminal`.
 */
export type EncodedChunk =
  | { readonly kind: 'data'; readonly payload: Record<string, unknown>; readonly event?: string }
  | { readonly kind: 'terminal' }

/** What one chunk writes: its `data:` text and, when named, its `event:`. */
export interface SseMessage {
  readonly data: string
  readonly event?: string
}

/**
 * Render a chunk for the wire. The serialisation is a write-only rendering of
 * a typed payload — there is no input to parse, so no Schema would add safety.
 */
export const renderSseChunk = (encoded: EncodedChunk): SseMessage => {
  if (encoded.kind === 'terminal') return { data: '[DONE]' }
  const { payload, event } = encoded
  return event === undefined
    ? { data: JSON.stringify(payload) }
    : { data: JSON.stringify(payload), event }
}
