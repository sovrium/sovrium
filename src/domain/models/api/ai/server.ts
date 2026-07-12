/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const aiServerStatusSchema = z.object({
  enabled: z.literal(true),
  transport: z.string(),
  mountPath: z.string(),
})

export const aiServerDisabledSchema = z.object({
  enabled: z.literal(false),
  error: z.string(),
})

export type AiServerStatus = z.infer<typeof aiServerStatusSchema>
export type AiServerDisabled = z.infer<typeof aiServerDisabledSchema>
