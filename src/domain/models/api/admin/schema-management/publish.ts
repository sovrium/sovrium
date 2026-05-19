/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { appVersionListItemResponseSchema } from './app-version-response'



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

export type PublishRequest = z.infer<typeof publishRequestSchema>


export const publishResponseSchema = z.object({
  version: appVersionListItemResponseSchema.describe('The newly-created version row'),
  activeVersion: z
    .number()
    .int()
    .positive()
    .describe('The new active version number after the swap'),
})

export type PublishResponse = z.infer<typeof publishResponseSchema>


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

export type PublishConflictResponse = z.infer<typeof publishConflictResponseSchema>
