/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const aiStatusEnabledSchema = z.object({
  enabled: z.literal(true),
})

export const aiStatusDisabledSchema = z.object({
  enabled: z.literal(false),
  error: z.string(),
})

export const aiStatusSchema = z.union([aiStatusEnabledSchema, aiStatusDisabledSchema])

export type AiStatusEnabled = z.infer<typeof aiStatusEnabledSchema>
export type AiStatusDisabled = z.infer<typeof aiStatusDisabledSchema>
export type AiStatus = z.infer<typeof aiStatusSchema>
