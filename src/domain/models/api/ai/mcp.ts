/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * Model Context Protocol (MCP) status API contract schemas.
 *
 * Mirrors the answers of `src/presentation/api/agents/mcp-status-routes.ts`.
 * Backs the OpenAPI documentation for the MCP status route group.
 */

/** MCP server enablement and transport configuration. */
export const mcpServerStatusSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  transport: Schema.String,
  mountPath: Schema.String,
})

/** Where one declared external MCP server stands. */
export const mcpServerStateSchema = Schema.Literals([
  'connected',
  'unavailable',
  'refused',
  'error',
]).annotate({
  description:
    'connected: the session is open. unavailable: it could not be reached. refused: the outbound guard refused its address. error: it answered, but not as an MCP server.',
})

/** One declared external MCP server (token omitted). */
export const mcpClientServerSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Name the server is declared under' }),
  url: Schema.String.annotate({ description: 'Declared address, without any user-info part' }),
  authType: Schema.Literals(['bearer', 'header', 'none']),
  headerName: optionalField(Schema.String),
  status: mcpServerStateSchema,
  toolCount: optionalField(
    Schema.Int.annotate({ description: 'How many tools it listed, present when connected' })
  ),
  reason: optionalField(
    Schema.String.annotate({ description: 'Why it is not connected, present otherwise' })
  ),
})

/** MCP client enablement and the configured external servers. */
export const mcpClientStatusSchema = Schema.Struct({
  enabled: Schema.Literal(true),
  servers: Schema.Array(mcpClientServerSchema),
})

/** A tool a connected server listed. */
export const mcpClientToolSchema = Schema.Struct({
  server: Schema.String.annotate({ description: 'Name of the server that listed it' }),
  name: Schema.String,
  description: Schema.String,
  inputSchema: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'JSON Schema of its arguments, as the server listed it',
  }),
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
