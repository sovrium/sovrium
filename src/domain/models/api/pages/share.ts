/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const shapedLinkSchema = z.object({
  id: z.string(),
  pageName: z.string(),
  token: z.string(),
  passwordProtected: z.boolean(),
  expiresAt: z.string().optional(),
  embedAllowed: z.boolean(),
  createdAt: z.string(),
  revokedAt: z.string().optional(),
  viewCount: z.number(),
  lastAccessedAt: z.string().optional(),
})

export type ShapedLink = z.infer<typeof shapedLinkSchema>
