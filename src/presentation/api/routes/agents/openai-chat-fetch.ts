/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Low-level OpenAI-compatible `/chat/completions` round-trip.
 *
 * The agent execution path (`agent-ai-call.ts`) and the agent-bound chat path
 * (`agent-chat.ts`) both POST a chat-completion body to an OpenAI-compatible
 * provider with Bearer auth, a 10s timeout, and a `.catch` that degrades any
 * transport failure to `undefined`. That request envelope is shared here so a
 * change to headers / timeout / error discipline is made once.
 *
 * NOTE: this is deliberately a raw `fetch` rather than the `AiService` Effect
 * port. The agent paths must put the per-agent `model` / `temperature`
 * overrides on the wire so the AI mock server's request recorder
 * (`ai.getChatRequests()`) can assert them — the port abstracts those away.
 */

/** Default request timeout for an agent AI round-trip (milliseconds). */
const AI_REQUEST_TIMEOUT_MS = 10_000

/** Connection details for an OpenAI-compatible provider. */
export interface OpenAiEndpoint {
  readonly baseUrl: string
  readonly apiKey: string
}

/**
 * POST a chat-completion `body` to `${baseUrl}/chat/completions`.
 *
 * Returns the raw `Response` on success, or `undefined` when the provider is
 * unreachable / the request times out — every caller in the agent paths is
 * tolerant of an absent response, so transport failures are swallowed here
 * rather than thrown.
 */
export const postChatCompletion = (
  endpoint: OpenAiEndpoint,
  body: Readonly<Record<string, unknown>>
): Promise<Response | undefined> =>
  fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  }).catch(() => undefined)
