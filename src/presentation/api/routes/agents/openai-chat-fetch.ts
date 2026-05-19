/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const AI_REQUEST_TIMEOUT_MS = 10_000

export interface OpenAiEndpoint {
  readonly baseUrl: string
  readonly apiKey: string
}

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
