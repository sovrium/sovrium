/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { draftResponseSchema } from './draft'

/**
 * Per-resource draft mutation request/response schemas
 *
 * Wire-format Zod contracts for the resource-scoped endpoints under
 * `/api/admin/schema/draft/{tables,pages,auth,theme,languages,components,
 *  forms,connections,env,actions,automations,agents,buckets,notifications,
 *  scripts}`.
 *
 * Each resource family follows the same pattern:
 *   - POST    {resource}            → create   (body: ResourceCreateRequest)
 *   - PATCH   {resource}/{ident}    → update   (body: ResourceUpdateRequest)
 *   - DELETE  {resource}/{ident}    → delete   (no body)
 *
 * Bodies are typed as `unknown` for the heterogeneous payload shapes —
 * Phase 3 handlers re-validate against the resource's domain Effect Schema
 * (e.g. `TableSchema`) before applying the mutation. This keeps the wire
 * contract decoupled from the recursive `AppSchema` shape.
 *
 * All POST/PATCH/DELETE endpoints return the canonical
 * `draftMutationResponseSchema` so the caller learns the post-mutation
 * draft state without a follow-up `GET /draft`.
 */

// ---------------------------------------------------------------------------
// Mutation response — shared by every per-resource POST/PATCH/DELETE
// ---------------------------------------------------------------------------

export const draftMutationResponseSchema = z.object({
  draft: draftResponseSchema.describe('Post-mutation draft state'),
  changed: z
    .boolean()
    .describe(
      'True when the mutation actually altered the draft. False on no-op (e.g. PATCH with identical fields).'
    ),
})

/** @public */
export type DraftMutationResponse = z.infer<typeof draftMutationResponseSchema>

// ---------------------------------------------------------------------------
// Tables — POST /draft/tables, PATCH /draft/tables/:slug, DELETE /draft/tables/:slug
// ---------------------------------------------------------------------------

export const tableCreateRequestSchema = z.object({
  table: z
    .unknown()
    .describe(
      'Encoded table definition. Re-validated against TableSchema; rejected with 400 + errors[] if invalid.'
    ),
})

/** @public */
export type TableCreateRequest = z.infer<typeof tableCreateRequestSchema>

export const tableUpdateRequestSchema = z.object({
  patch: z
    .unknown()
    .describe(
      'Partial table fields to merge into the existing table (deep-merge for nested objects, replace for arrays).'
    ),
})

/** @public */
export type TableUpdateRequest = z.infer<typeof tableUpdateRequestSchema>

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export const pageCreateRequestSchema = z.object({
  page: z.unknown().describe('Encoded page definition. Re-validated against PageSchema.'),
})

/** @public */
export type PageCreateRequest = z.infer<typeof pageCreateRequestSchema>

export const pageUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial page fields to merge into the existing page.'),
})

/** @public */
export type PageUpdateRequest = z.infer<typeof pageUpdateRequestSchema>

// ---------------------------------------------------------------------------
// Auth strategies — POST /draft/auth/strategies, PATCH/DELETE by `:type`
// ---------------------------------------------------------------------------

export const authStrategyCreateRequestSchema = z.object({
  strategy: z
    .unknown()
    .describe(
      'Encoded auth-strategy definition (emailAndPassword, magicLink, oauth, etc.). Re-validated against the AuthStrategy union.'
    ),
})

/** @public */
export type AuthStrategyCreateRequest = z.infer<typeof authStrategyCreateRequestSchema>

export const authStrategyUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial auth-strategy fields to merge into the existing strategy.'),
})

/** @public */
export type AuthStrategyUpdateRequest = z.infer<typeof authStrategyUpdateRequestSchema>

// ---------------------------------------------------------------------------
// Generic resource shapes — used by the remaining resource families to keep
// the response surface small and the parameterisation legible.
// ---------------------------------------------------------------------------

/**
 * Generic create body — `payload: unknown`. The path determines the resource
 * type (`/draft/components`, `/draft/forms`, ...) and the handler picks the
 * right domain validator from the `ResourceFamily` registry.
 */
export const resourceCreateRequestSchema = z.object({
  payload: z
    .unknown()
    .describe('Encoded resource definition. Validated against the family-specific Effect Schema.'),
})

/** @public */
export type ResourceCreateRequest = z.infer<typeof resourceCreateRequestSchema>

export const resourceUpdateRequestSchema = z.object({
  patch: z.unknown().describe('Partial resource fields to merge into the existing entry.'),
})

/** @public */
export type ResourceUpdateRequest = z.infer<typeof resourceUpdateRequestSchema>

// ---------------------------------------------------------------------------
// Resource family registry — used by the generic /draft/{family} routes to
// pick the right validator. Phase 3 extends this list as new families ship.
// ---------------------------------------------------------------------------

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

/** @public */
export type ResourceFamily = z.infer<typeof resourceFamilySchema>
