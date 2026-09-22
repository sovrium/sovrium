/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Model Context Protocol (MCP) status API contract schemas.
 *
 * Mirrors the runtime shapes in `src/presentation/api/routes/ai-mcp-status.ts`.
 * Backs the OpenAPI documentation for the MCP status route group.
 */

/** MCP server enablement and transport configuration. */
export const mcpServerStatusSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  transport: Schema.String,
  mountPath: Schema.String,
})

/** A single configured external MCP server (token omitted). */
export const mcpClientServerSchema = Schema.Struct({
  url: Schema.String,
  authType: Schema.Literals(['bearer', 'header', 'none']),
  headerName: optionalField(Schema.String),
  status: Schema.Literal('connecting'),
})

/** MCP client enablement and the configured external servers. */
export const mcpClientStatusSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  servers: Schema.Array(mcpClientServerSchema),
})

/** A discovered MCP tool. */
export const mcpClientToolSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
})

/** MCP client enablement and the discovered tool catalog. */
export const mcpClientToolsSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  tools: Schema.Array(mcpClientToolSchema),
})

/** Envelope returned (with status 404) when an MCP mode is disabled. */
export const mcpDisabledSchema = Schema.Struct({
  enabled: Schema.Literal(false),
  error: Schema.String,
})

/** @public */
export type McpServerStatus = typeof mcpServerStatusSchema.Type
/** @public */
export type McpClientServer = typeof mcpClientServerSchema.Type
/** @public */
export type McpClientStatus = typeof mcpClientStatusSchema.Type
/** @public */
export type McpClientTool = typeof mcpClientToolSchema.Type
/** @public */
export type McpClientTools = typeof mcpClientToolsSchema.Type
/** @public */
export type McpDisabled = typeof mcpDisabledSchema.Type
