/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Low-level OpenAI-compatible `/chat/completions` round-trip.
 *
 * ONE caller: the agent EXECUTION path (`agent-ai-call.ts`). It POSTs a
 * chat-completion body with Bearer auth, a 10s timeout, and a `.catch` that
 * degrades any transport failure to `undefined`.
 *
 * The agent-bound CHAT path used to share it. It no longer does — it goes
 * through the `AiService` port, which is what let it gain the tool-execution
 * loop, populated `actions[]`, and provider-aware endpoint selection. The old
 * rationale here claimed the raw fetch was necessary because "the port
 * abstracts the per-agent `model` / `temperature` overrides away"; that was
 * simply false — `ChatInput` carries `model`, `temperature`, `maxTokens` and
 * `tools`, and forwards each onto whichever wire format the provider speaks.
 *
 * Do NOT try to fix that by asking operators to add `/v1` to the base URL.
 * Measured against a real Ollama on 2026-08-25 — there is NO value of
 * `OLLAMA_BASE_URL` that satisfies every consumer, because three of them append
 * different paths to the same variable:
 *
 *   base                 this module          ollama-chat.ts     reachability probe
 *                        /chat/completions    /api/chat          /api/tags
 *   ------------------   ------------------   ---------------    ------------------
 *   http://host:11434    404                  200                200  (reachable)
 *   http://host:11434/v1 200                  404                404  (UNREACHABLE)
 *
 * Whichever way an operator sets it, something silently breaks — and in the
 * `/v1` case `/api/health` starts reporting `ollamaReachable: false` while chat
 * appears to work. That measurement is why the agent CHAT path was moved onto
 * the port rather than having its URL patched, and it is why `agent-chat.ts`
 * got SHORTER (283 -> 195 lines) in the process: the port already knows that
 * Ollama means native `/api/chat` and a cloud provider means
 * `/chat/completions`. Re-proposing the URL patch re-opens all three rows.
 *
 * So do NOT read this module as an endorsement of raw fetch for new work. It
 * hard-codes the OpenAI-compatible `/chat/completions` path, which 404s against
 * an Ollama base URL — the provider Sovrium defaults to. Anything new belongs
 * on the port. This survives only because its remaining caller has not been
 * migrated.
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
