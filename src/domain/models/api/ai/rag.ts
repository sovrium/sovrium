/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const ragRebuildRequestSchema = z.object({
  agent: z
    .string()
    .optional()
    .describe('Agent name to rebuild knowledge for (rebuilds all agents if omitted)'),
})


export const ragRebuildStatsSchema = z.object({
  tables: z
    .record(z.string(), z.number().int())
    .describe('Map of table name to number of chunks generated'),
  documents: z
    .record(z.string(), z.number().int())
    .describe('Map of document path to number of chunks generated'),
  totalChunks: z.number().int().min(0).describe('Total number of chunks across all sources'),
  duration: z.number().min(0).describe('Rebuild duration in milliseconds'),
})


export const ragRebuildResponseSchema = z.object({
  status: z.enum(['completed', 'failed']).describe('Whether the rebuild completed successfully'),
  agent: z.string().optional().describe('Agent name that was rebuilt (absent if all agents)'),
  stats: ragRebuildStatsSchema.describe('Rebuild statistics'),
})


export type RagRebuildRequest = z.infer<typeof ragRebuildRequestSchema>
export type RagRebuildStats = z.infer<typeof ragRebuildStatsSchema>
export type RagRebuildResponse = z.infer<typeof ragRebuildResponseSchema>
