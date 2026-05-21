/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const ragSearchRequestSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Natural-language query to embed and match against the knowledge base'),
  agent: z
    .string()
    .optional()
    .describe('Agent name to scope the search to (searches all agents if omitted)'),
})

export type RagSearchRequest = z.infer<typeof ragSearchRequestSchema>


export const ragSearchResultSchema = z.object({
  agentName: z.string().describe('Name of the agent the matched knowledge belongs to'),
  sourceRef: z.string().describe('Reference to the source document or table record'),
  content: z.string().describe('The matched knowledge chunk content'),
  similarity: z
    .number()
    .min(0)
    .max(1)
    .describe('Cosine similarity score in the range 0..1 (higher is more relevant)'),
})

export type RagSearchResult = z.infer<typeof ragSearchResultSchema>

export const ragSearchResponseSchema = z.object({
  results: z
    .array(ragSearchResultSchema)
    .describe('Matched knowledge chunks ordered by descending similarity'),
})

export type RagSearchResponse = z.infer<typeof ragSearchResponseSchema>
