/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * App-version API response schemas
 *
 * Wire-format Zod contracts for the version-history endpoints under
 * `/api/admin/schema/versions`. These mirror the Effect Schema models in
 * `src/domain/models/system/app-version.ts` but with ISO-8601 timestamps
 * (not `Date`) and `snapshot: unknown` so the Hono route can serialise the
 * encoded App body without re-deriving the (recursive) `AppSchema` shape.
 */

// ---------------------------------------------------------------------------
// List item — slim view, no snapshot. Used by GET /versions
// ---------------------------------------------------------------------------

export const appVersionListItemResponseSchema = z.object({
  versionNumber: z
    .number()
    .int()
    .positive()
    .describe('Monotonic version number assigned at publish time (>= 1)'),
  checksum: z.string().min(1).describe('Stable hash of the version snapshot for cache validation'),
  createdAt: z.iso.datetime().describe('ISO 8601 publish timestamp'),
  createdByUserId: z.string().min(1).describe('Better Auth user id of the publisher'),
  message: z.string().describe('Operator-supplied publish message (may be empty)'),
  restoredFromVersion: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('When set, indicates this version was created via POST /versions/:n/restore'),
})

/** @public */
export type AppVersionListItemResponse = z.infer<typeof appVersionListItemResponseSchema>

// ---------------------------------------------------------------------------
// List response — sorted descending by versionNumber
// ---------------------------------------------------------------------------

export const listVersionsResponseSchema = z.object({
  versions: z
    .array(appVersionListItemResponseSchema)
    .describe('All published versions, sorted newest-first by versionNumber'),
  activeVersion: z
    .number()
    .int()
    .min(0)
    .describe(
      'Currently-live version number, or 0 if no version has ever been published (bootstrap)'
    ),
  draftBaseVersion: z
    .number()
    .int()
    .min(0)
    .describe('baseVersion of the singleton draft, used for optimistic concurrency on publish'),
})

/** @public */
export type ListVersionsResponse = z.infer<typeof listVersionsResponseSchema>

// ---------------------------------------------------------------------------
// Single version — full record with snapshot. Used by GET /versions/:n
// ---------------------------------------------------------------------------

export const appVersionResponseSchema = appVersionListItemResponseSchema.extend({
  snapshot: z
    .unknown()
    .describe('Full encoded App schema body (the same shape as Schema.encode(AppSchema))'),
})

/** @public */
export type AppVersionResponse = z.infer<typeof appVersionResponseSchema>

// ---------------------------------------------------------------------------
// Restore request body
// ---------------------------------------------------------------------------

export const restoreVersionRequestSchema = z.object({
  message: z
    .string()
    .max(500)
    .optional()
    .describe(
      'Optional publish message for the new restored version (defaults to "Restored from version N")'
    ),
})

/** @public */
export type RestoreVersionRequest = z.infer<typeof restoreVersionRequestSchema>

// ---------------------------------------------------------------------------
// Restore response — returns the newly-created version + new active version
// ---------------------------------------------------------------------------

export const restoreVersionResponseSchema = z.object({
  version: appVersionListItemResponseSchema.describe(
    'The newly-created version (its restoredFromVersion will name the source)'
  ),
  activeVersion: z.number().int().positive().describe('New active version after the restore'),
})

/** @public */
export type RestoreVersionResponse = z.infer<typeof restoreVersionResponseSchema>
