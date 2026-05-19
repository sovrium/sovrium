/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'



export const draftResponseSchema = z.object({
  snapshot: z
    .unknown()
    .describe('Mutable encoded App schema. Same shape as Schema.encode(AppSchema)'),
  baseVersion: z
    .number()
    .int()
    .min(0)
    .describe(
      'Active version number this draft was branched from. Used as the publish optimistic-concurrency token. 0 means "no version published yet" (bootstrap).'
    ),
  updatedAt: z.iso.datetime().describe('ISO 8601 timestamp of the most recent draft mutation'),
  updatedByUserId: z.string().min(1).describe('Better Auth user id of the most recent editor'),
  dirty: z
    .boolean()
    .describe(
      'True when the draft snapshot differs from the active version. Drives the "Publish" button enabled-state in admin UIs.'
    ),
})

export type DraftResponse = z.infer<typeof draftResponseSchema>


export const putDraftRequestSchema = z.object({
  snapshot: z
    .unknown()
    .describe(
      'Full encoded App body to install as the new draft. Server re-validates against AppSchema; rejects with 400 + errors[] on validation failure.'
    ),
  baseVersion: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Optional optimistic-concurrency check. When set, request fails with 409 if it does not match the current draft.baseVersion (i.e. another admin published in between).'
    ),
})

export type PutDraftRequest = z.infer<typeof putDraftRequestSchema>


export const discardDraftResponseSchema = z.object({
  draft: draftResponseSchema.describe(
    'The reset draft. snapshot equals the active-version snapshot; dirty is false.'
  ),
})

export type DiscardDraftResponse = z.infer<typeof discardDraftResponseSchema>


export const validateDraftResponseSchema = z.object({
  valid: z.boolean().describe('True when the current draft passes AppSchema validation'),
  errors: z
    .array(
      z.object({
        path: z
          .string()
          .describe(
            'JSON Pointer-style path to the offending field (e.g. "/tables/0/fields/2/type")'
          ),
        message: z.string().describe('Human-readable validation message'),
      })
    )
    .describe('Validation errors, empty when valid=true'),
})

export type ValidateDraftResponse = z.infer<typeof validateDraftResponseSchema>
