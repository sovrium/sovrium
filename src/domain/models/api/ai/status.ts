/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
export const aiStatusEnabledSchema = Schema.Struct({
  enabled: Schema.Literal(true),
})

/** A status response for a DISABLED MCP mode — returned with status 404. */
export const aiStatusDisabledSchema = Schema.Struct({
  enabled: Schema.Literal(false),
  error: Schema.String,
})

/** The full status envelope: either an enabled detail or a disabled reason. */
export const aiStatusSchema = Schema.Union([aiStatusEnabledSchema, aiStatusDisabledSchema])

/** @public */
export type AiStatusEnabled = typeof aiStatusEnabledSchema.Type
/** @public */
export type AiStatusDisabled = typeof aiStatusDisabledSchema.Type
/** @public */
export type AiStatus = typeof aiStatusSchema.Type
