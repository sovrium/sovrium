/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Search engine enum (mirrors Effect Schema SearchEngineSchema)
// ---------------------------------------------------------------------------

export const searchEngineEnum = z
  .enum(['client', 'fts', 'trigram', 'hybrid'])
  .describe('Search backend engine used for the query')

// ---------------------------------------------------------------------------
// Search request schema
// ---------------------------------------------------------------------------

/**
 * Search request schema for the search API endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via @hono/zod-validator
 * - Hono RPC client type inference
 */
export const searchRequestSchema = z.object({
  query: z.string().min(1).describe('Search query string'),
  table: z.string().min(1).describe('Table name to search'),
  fields: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe('Specific fields to search (defaults to all indexed fields)'),
  engine: searchEngineEnum.optional().describe('Search engine override (defaults to client)'),
  limit: z.number().int().positive().max(200).optional().describe('Maximum results to return'),
  offset: z.number().int().min(0).optional().describe('Pagination offset'),
  highlight: z.boolean().optional().describe('Return highlight snippets for matched terms'),
})

// ---------------------------------------------------------------------------
// Search result item schema
// ---------------------------------------------------------------------------

/**
 * A single search result with optional relevance score and highlights.
 */
export const searchResultItemSchema = z.object({
  id: z.string().describe('Record primary key'),
  score: z.number().optional().describe('Relevance score (FTS/hybrid engine only)'),
  highlights: z
    .record(z.string(), z.string())
    .optional()
    .describe('Map of field name to highlighted snippet with <mark> tags'),
  record: z.record(z.string(), z.unknown()).describe('Full or partial record data'),
})

// ---------------------------------------------------------------------------
// Search response schema
// ---------------------------------------------------------------------------

/**
 * Search response schema for the search API endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API response validation
 * - Hono RPC client type inference
 */
export const searchResponseSchema = z.object({
  results: z.array(searchResultItemSchema).describe('Matching records'),
  total: z.number().int().min(0).describe('Total number of matching records'),
  query: z.string().describe('Echo of the search query'),
  engine: searchEngineEnum.describe('Engine that was used for the query'),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type SearchRequest = z.infer<typeof searchRequestSchema>
export type SearchResultItem = z.infer<typeof searchResultItemSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
