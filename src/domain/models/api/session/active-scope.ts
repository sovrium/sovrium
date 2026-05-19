/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const setActiveScopeRequestSchema = z.object({ recordId: z.string() })

export const activeScopeSetResponseSchema = z.object({
  tableSlug: z.string(),
  recordId: z.string(),
})

export const activeScopeGetResponseSchema = z.object({
  tableSlug: z.string(),
  recordId: z.string().nullable(),
})

export type SetActiveScopeRequest = z.infer<typeof setActiveScopeRequestSchema>
export type ActiveScopeSetResponse = z.infer<typeof activeScopeSetResponseSchema>
export type ActiveScopeGetResponse = z.infer<typeof activeScopeGetResponseSchema>
