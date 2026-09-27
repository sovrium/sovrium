/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defineLibraryEntry, type LibraryOperations } from '@/library/manifest/define'

/**
 * The starter operation, byte-for-byte the one the generated Mistral set
 * carries, so installing it again later is a no-op.
 */
const OPERATIONS: LibraryOperations = [
  {
    name: 'chat-completion',
    method: 'POST',
    path: '/v1/chat/completions',
    summary: 'Chat Completion',
    params: {
      model: { in: 'body', type: 'string', required: true },
      temperature: { in: 'body', type: 'number' },
      top_p: { in: 'body', type: 'number' },
      max_tokens: { in: 'body', type: 'integer' },
      stream: { in: 'body', type: 'boolean' },
      stop: { in: 'body', type: 'array' },
      random_seed: { in: 'body', type: 'integer' },
      metadata: { in: 'body', type: 'object' },
      messages: { in: 'body', type: 'array', required: true },
      response_format: { in: 'body', type: 'object' },
      tools: { in: 'body', type: 'array' },
      tool_choice: { in: 'body', type: 'object' },
      presence_penalty: { in: 'body', type: 'number' },
      frequency_penalty: { in: 'body', type: 'number' },
      n: { in: 'body', type: 'integer' },
      prediction: { in: 'body', type: 'object' },
      parallel_tool_calls: { in: 'body', type: 'boolean' },
      reasoning_effort: { in: 'body', type: 'string' },
      prompt_mode: { in: 'body', type: 'string' },
      guardrails: { in: 'body', type: 'array' },
      prompt_cache_key: { in: 'body', type: 'string' },
      service_tier: { in: 'body', type: 'string' },
      safe_prompt: { in: 'body', type: 'boolean' },
    },
  },
]

/** Mistral's API, authenticated by an API key sent as a bearer. */
export const entry = defineLibraryEntry({
  kind: 'connection',
  slug: 'mistral',
  title: 'Mistral AI models (API key)',
  category: 'ai',
  tags: ['mistral', 'ai', 'llm', 'chat', 'completion', 'summary'],
  description:
    'Authenticated calls to the Mistral API with an API key, starting with chat completions.',
  notes: [
    'Create an API key in the Mistral console under API Keys and set it as the environment variable. Mistral reads it as `Authorization: Bearer <key>`.',
    'The connection ships with `chat-completion`: pass a `model` (for example `mistral-small-latest`) and a `messages` array of `{ role, content }` objects, and read the answer at `steps.<name>.data.choices`. Add other endpoints with `sovrium library add mistral/<operation>`.',
  ],
  params: [],
  env: ['MISTRAL_API_KEY'],
  requires: [],
  provider: {
    name: 'Mistral AI',
    docsUrl: 'https://docs.mistral.ai/api/',
    verifiedOn: '2026-09-24',
  },
  build: ({ name }) => ({
    name,
    type: 'bearer',
    label: 'Mistral AI',
    description: 'Mistral API, authenticated with an API key',
    props: { token: '$env.MISTRAL_API_KEY' },
    baseUrl: 'https://api.mistral.ai',
    operations: OPERATIONS,
  }),
})
