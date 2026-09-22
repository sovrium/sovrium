/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * MCP server-mode API contract schema — the `server` sub-resource of the
 * `/api/ai/mcp` status route group (`GET /api/ai/mcp/server/status`).
 *
 * Mirrors the runtime server-status shape served by
 * `src/presentation/api/routes/ai-mcp-status.ts`. Backs the OpenAPI
 * documentation for the MCP server status endpoint.
 */

/** Enabled MCP server: the active transport and the path the server mounts on. */
export const aiServerStatusSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  transport: Schema.String,
  mountPath: Schema.String,
})

/** Envelope returned (with status 404) when MCP server mode is disabled. */
export const aiServerDisabledSchema = Schema.Struct({
  enabled: Schema.Literal(false),
  error: Schema.String,
})

/** @public */
export type AiServerStatus = typeof aiServerStatusSchema.Type
/** @public */
export type AiServerDisabled = typeof aiServerDisabledSchema.Type
