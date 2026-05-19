/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { draftResponseSchema } from './draft'



export const draftMutationResponseSchema = z.object({
  draft: draftResponseSchema.describe('Post-mutation draft state'),
  changed: z
    .boolean()
    .describe(
      'True when the mutation actually altered the draft. False on no-op (e.g. PATCH with identical fields).'
    ),
})

export type DraftMutationResponse = z.infer<typeof draftMutationResponseSchema>


export const tableCreateRequestSchema = z.object({
  table: z
    .unknown()
    .describe(
      'Encoded table definition. Re-validated against TableSchema; rejected with 400 + errors[] if invalid.'
    ),
})

export type TableCreateRequest = z.infer<typeof tableCreateRequestSchema>

export const tableUpdateRequestSchema = z.object({
  patch: z
    .unknown()
    .describe(
      'Partial table fields to merge into the existing table (deep-merge for nested objects, replace for arrays).'
    ),
})

export type TableUpdateRequest = z.infer<typeof tableUpdateRequestSchema>


export const pageCreateRequestSchema = z.object({
  page: z.unknown().describe('Encoded page definition. Re-validated against PageSchema.'),
})

export type PageCreateRequest = z.infer<typeof pageCreateRequestSchema>

export const pageUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial page fields to merge into the existing page.'),
})

export type PageUpdateRequest = z.infer<typeof pageUpdateRequestSchema>


export const authStrategyCreateRequestSchema = z.object({
  strategy: z
    .unknown()
    .describe(
      'Encoded auth-strategy definition (emailAndPassword, magicLink, oauth, etc.). Re-validated against the AuthStrategy union.'
    ),
})

export type AuthStrategyCreateRequest = z.infer<typeof authStrategyCreateRequestSchema>

export const authStrategyUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial auth-strategy fields to merge into the existing strategy.'),
})

export type AuthStrategyUpdateRequest = z.infer<typeof authStrategyUpdateRequestSchema>


export const resourceCreateRequestSchema = z.object({
  payload: z
    .unknown()
    .describe('Encoded resource definition. Validated against the family-specific Effect Schema.'),
})

export type ResourceCreateRequest = z.infer<typeof resourceCreateRequestSchema>

export const resourceUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial resource fields to merge into the existing entry.'),
})

export type ResourceUpdateRequest = z.infer<typeof resourceUpdateRequestSchema>


export const resourceFamilySchema = z.enum([
  'tables',
  'pages',
  'auth/strategies',
  'theme',
  'languages',
  'components',
  'forms',
  'connections',
  'env',
  'actions',
  'automations',
  'agents',
  'buckets',
  'notifications',
  'scripts',
])

export type ResourceFamily = z.infer<typeof resourceFamilySchema>
