/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * MCP server-mode API contract schema — the `server` sub-resource of the
 * `/api/ai/mcp` status route group (`GET /api/ai/mcp/server/status`).
 *
 * Mirrors the runtime server-status shape served by
 * `src/presentation/api/routes/ai-mcp-status.ts`. Backs the OpenAPI
 * documentation for the MCP server status endpoint.
 */

/** Enabled MCP server: the active transport and the path the server mounts on. */
export const aiServerStatusSchema = z.object({
  enabled: z.literal(true),
  transport: z.string(),
  mountPath: z.string(),
})

/** Envelope returned (with status 404) when MCP server mode is disabled. */
export const aiServerDisabledSchema = z.object({
  enabled: z.literal(false),
  error: z.string(),
})

/** @public */
export type AiServerStatus = z.infer<typeof aiServerStatusSchema>
/** @public */
export type AiServerDisabled = z.infer<typeof aiServerDisabledSchema>
