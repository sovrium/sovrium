/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'

export const adminSearchEntityTypes = [
  'record',
  'submission',
  'run',
  'user',
  'file',
  'conversation',
  'connection',
] as const

export const adminSearchEntityTypeSchema = z
  .enum(adminSearchEntityTypes)
  .describe(
    'The admin entity kind this result belongs to. Drives the per-type result group + badge.'
  )

export type AdminSearchEntityType = z.infer<typeof adminSearchEntityTypeSchema>

export const adminSearchResultSchema = z
  .object({
    type: adminSearchEntityTypeSchema,
    entityId: z
      .string()
      .describe(
        'The source entity id, carried verbatim into the deep-link. Heterogeneous across kinds (record / submission / user / connection ids…).'
      ),
    title: z
      .string()
      .describe(
        'Secret-free primary label shown as the result line. Connection = NAME/label only; file = file NAME only; user = e-mail/display label; record = first text column. NEVER a token/credential (S4).'
      ),
    href: z
      .string()
      .describe(
        'The deep-link the UI navigates to when this result is selected (e.g. /_admin/tables/{name}?record={id}, /_admin/connections).'
      ),
    updatedAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 last-touch time of the source entity, used to order results (most recent first) within a type group.'
      ),
  })
  .strict()
  .describe('One admin global-search result (S4 secret-free allow-list).')

export type AdminSearchResult = z.infer<typeof adminSearchResultSchema>

export const adminSearchGroupSchema = z
  .object({
    type: adminSearchEntityTypeSchema,
    results: z
      .array(adminSearchResultSchema)
      .describe('Matches for this entity kind, most-recent first (capped per group).'),
  })
  .strict()
  .describe('A per-type group of global-search results.')

export type AdminSearchGroup = z.infer<typeof adminSearchGroupSchema>

export const adminSearchResponseSchema = z
  .object({
    query: z.string().describe('The trimmed query term the index was searched with.'),
    groups: z
      .array(adminSearchGroupSchema)
      .describe(
        'Per-type result sections in canonical kind order. Empty array = no results (still a 200).'
      ),
  })
  .strict()
  .describe('Admin global-search response — cross-entity results grouped by kind.')

export type AdminSearchResponse = z.infer<typeof adminSearchResponseSchema>
