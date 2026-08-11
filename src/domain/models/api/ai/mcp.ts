/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * Model Context Protocol (MCP) status API contract schemas.
 *
 * Mirrors the runtime shapes in `src/presentation/api/routes/ai-mcp-status.ts`.
 * Backs the OpenAPI documentation for the MCP status route group.
 */

/** MCP server enablement and transport configuration. */
export const mcpServerStatusSchema = z.object({
  enabled: z.literal(true),
  transport: z.string(),
  mountPath: z.string(),
})

/** A single configured external MCP server (token omitted). */
export const mcpClientServerSchema = z.object({
  url: z.string(),
  authType: z.enum(['bearer', 'header', 'none']),
  headerName: z.string().optional(),
  status: z.literal('connecting'),
})

/** MCP client enablement and the configured external servers. */
export const mcpClientStatusSchema = z.object({
  enabled: z.literal(true),
  servers: z.array(mcpClientServerSchema),
})

/** A discovered MCP tool. */
export const mcpClientToolSchema = z.object({ name: z.string(), description: z.string() })

/** MCP client enablement and the discovered tool catalog. */
export const mcpClientToolsSchema = z.object({
  enabled: z.literal(true),
  tools: z.array(mcpClientToolSchema),
})

/** Envelope returned (with status 404) when an MCP mode is disabled. */
export const mcpDisabledSchema = z.object({ enabled: z.literal(false), error: z.string() })

/** @public */
export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>
/** @public */
export type McpClientServer = z.infer<typeof mcpClientServerSchema>
/** @public */
export type McpClientStatus = z.infer<typeof mcpClientStatusSchema>
/** @public */
export type McpClientTool = z.infer<typeof mcpClientToolSchema>
/** @public */
export type McpClientTools = z.infer<typeof mcpClientToolsSchema>
/** @public */
export type McpDisabled = z.infer<typeof mcpDisabledSchema>
