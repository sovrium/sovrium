/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * MCP status API contract schema — the `status` sub-resource shared by the
 * `/api/ai/mcp` status route group (`GET /api/ai/mcp/server/status`,
 * `GET /api/ai/mcp/client/status`).
 *
 * Mirrors the enablement envelope served by
 * `src/presentation/api/routes/ai-mcp-status.ts`: an enabled response carries
 * mode-specific detail (asserted by the per-mode schemas), while a disabled
 * mode returns a 404 envelope with a human-readable reason.
 */

/** A status response for an ENABLED MCP mode (server or client). */
export const aiStatusEnabledSchema = z.object({
  enabled: z.literal(true),
})

/** A status response for a DISABLED MCP mode — returned with status 404. */
export const aiStatusDisabledSchema = z.object({
  enabled: z.literal(false),
  error: z.string(),
})

/** The full status envelope: either an enabled detail or a disabled reason. */
export const aiStatusSchema = z.union([aiStatusEnabledSchema, aiStatusDisabledSchema])

/** @public */
export type AiStatusEnabled = z.infer<typeof aiStatusEnabledSchema>
/** @public */
export type AiStatusDisabled = z.infer<typeof aiStatusDisabledSchema>
/** @public */
export type AiStatus = z.infer<typeof aiStatusSchema>
