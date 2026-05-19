/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'



export const schemaStatusResponseSchema = z.object({
  apiEnabled: z
    .boolean()
    .describe(
      'True when SCHEMA_EDIT_API_ENABLED=true. When false, every other /api/admin/schema/* route returns 404.'
    ),
  bootstrapMode: z
    .boolean()
    .describe(
      'True when the server is in bootstrap mode (no admin user yet, no AUTH_ADMIN_EMAIL env). Mirrors POST /api/admin/bootstrap/claim availability.'
    ),
  activeVersion: z
    .number()
    .int()
    .min(0)
    .describe(
      'Currently-live version number, or 0 when no version has ever been published (bootstrap state)'
    ),
  draftDirty: z
    .boolean()
    .describe('True when the draft snapshot differs from the active-version snapshot'),
  draftBaseVersion: z
    .number()
    .int()
    .min(0)
    .describe(
      'The version this draft was branched from (used as the publish optimistic-concurrency token)'
    ),
  previewActive: z
    .boolean()
    .describe('True when a non-expired preview server is currently running'),
  previewExpiresAt: z.iso
    .datetime()
    .optional()
    .describe('When previewActive=true, the ISO 8601 expiry of that preview'),
})

export type SchemaStatusResponse = z.infer<typeof schemaStatusResponseSchema>
