/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { appVersionListItemResponseSchema } from './app-version-response'

/**
 * Publish API request/response schemas
 *
 * Wire-format Zod contracts for `POST /api/admin/schema/draft/publish`.
 *
 * Publish is atomic:
 *
 *   1. Validate the current draft against `AppSchema` (rejects with 400 +
 *      `errors[]` if invalid).
 *   2. Re-check `baseVersion` matches the active version (409 if not).
 *   3. Insert a new row into `system.sovrium_app_versions` with the draft
 *      snapshot.
 *   4. Atomically swap the live App via `AppRef.swap(newApp)`.
 *   5. Reset the draft's `baseVersion` to the new active version.
 *
 * The 409 conflict path is the optimistic-concurrency token: another
 * admin published in between this admin's GET /draft and POST /publish.
 * The error body returns both the expected and actual version numbers
 * so a smart client (or MCP tool) can decide whether to rebase or
 * surface to the operator.
 */

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

export const publishRequestSchema = z.object({
  baseVersion: z
    .number()
    .int()
    .min(0)
    .describe(
      'The active version number this draft was branched from. Must match draft.baseVersion AND the current active version, otherwise the request fails with 409.'
    ),
  message: z
    .string()
    .max(500)
    .optional()
    .describe('Operator-supplied publish message. Persisted on the new version row.'),
})

/** @public */
export type PublishRequest = z.infer<typeof publishRequestSchema>

// ---------------------------------------------------------------------------
// Success response
// ---------------------------------------------------------------------------

export const publishResponseSchema = z.object({
  version: appVersionListItemResponseSchema.describe('The newly-created version row'),
  activeVersion: z
    .number()
    .int()
    .positive()
    .describe('The new active version number after the swap'),
})

/** @public */
export type PublishResponse = z.infer<typeof publishResponseSchema>

// ---------------------------------------------------------------------------
// 409 Conflict response — optimistic concurrency mismatch
// ---------------------------------------------------------------------------

export const publishConflictResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.literal('CONFLICT'),
  expected: z
    .number()
    .int()
    .min(0)
    .describe('The baseVersion the client supplied (also the version they last loaded)'),
  actual: z
    .number()
    .int()
    .min(0)
    .describe('The current active version on the server (the value the client must rebase to)'),
})

/** @public */
export type PublishConflictResponse = z.infer<typeof publishConflictResponseSchema>
