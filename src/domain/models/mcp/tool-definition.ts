/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// MCP tool annotations (risk vocabulary on the wire)
// ---------------------------------------------------------------------------

/**
 * Wire-format annotations attached to each MCP tool definition. The field
 * names use the `Hint` suffix per the MCP spec 2025-06 (e.g. `readOnlyHint`),
 * which is what AI clients read off the wire to drive auto-approve vs.
 * confirmation UX. Compiled by the MCP server from the entity's
 * `aiAccess.annotations` (which uses non-suffixed names internally) plus
 * sensible defaults derived from the operation type.
 */
export const McpToolWireAnnotationsSchema = Schema.Struct({
  readOnlyHint: Schema.optional(Schema.Boolean),
  destructiveHint: Schema.optional(Schema.Boolean),
  idempotentHint: Schema.optional(Schema.Boolean),
  openWorldHint: Schema.optional(Schema.Boolean),
  title: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    identifier: 'McpToolWireAnnotations',
    title: 'MCP Tool Wire Annotations',
    description:
      'Risk hints exposed to MCP clients on the wire. Field names use the Hint suffix per MCP spec 2025-06.',
  })
)

/** @public */
export type McpToolWireAnnotations = typeof McpToolWireAnnotationsSchema.Type

// ---------------------------------------------------------------------------
// MCP tool definition schema
// ---------------------------------------------------------------------------

/**
 * Schema for an MCP tool definition exposed by Sovrium's MCP server mode,
 * matching the wire format that AI clients (Claude Desktop, Claude Code,
 * ChatGPT Dev Mode, Cursor) consume from `tools/list`.
 *
 * Each tool represents a capability that external AI clients can invoke
 * (e.g. `{appName}_contacts_list`, `{appName}_action_archive_record`,
 * `{appName}_automation_send_quarterly_report`).
 *
 * **Lives under `models/mcp/`** (not `models/api/`) because MCP transports
 * (JSON-RPC over stdio or Streamable HTTP) are not classical REST routes —
 * they don't follow the `routes/X/` directory mirror that the API schema
 * validator expects. Effect Schema is used (not Zod) because Zod is
 * restricted in `src/` outside of `models/api/` and `presentation/`.
 */
export const mcpToolDefinitionSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description:
        'Tool name with appName prefix (e.g. crm_contacts_list, crm_action_archive_record).',
    })
  ),
  description: Schema.String.pipe(
    Schema.annotations({ description: 'Human-readable description of what the tool does.' })
  ),
  inputSchema: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
    Schema.annotations({ description: 'JSON Schema describing the tool input parameters.' })
  ),
  annotations: Schema.optional(McpToolWireAnnotationsSchema),
}).pipe(
  Schema.annotations({
    identifier: 'McpToolDefinition',
    title: 'MCP Tool Definition (wire format)',
    description:
      "A single tool entry returned by tools/list. Compiled from the schema author's aiAccess declarations on tables, automations, and action templates.",
  })
)

/** @public */
export type McpToolDefinition = typeof mcpToolDefinitionSchema.Type

// ---------------------------------------------------------------------------
// MCP tool result schema
// ---------------------------------------------------------------------------

export const McpToolResultContentBlockSchema = Schema.Struct({
  type: Schema.Literal('text', 'image', 'resource'),
  text: Schema.optional(Schema.String),
}).pipe(
  Schema.annotations({
    identifier: 'McpToolResultContentBlock',
    title: 'MCP Tool Result Content Block',
    description: 'Single content block returned by a tool invocation.',
  })
)

/**
 * Schema for the result returned by an MCP tool invocation (`tools/call`
 * response payload).
 */
export const mcpToolResultSchema = Schema.Struct({
  content: Schema.Array(McpToolResultContentBlockSchema).pipe(
    Schema.annotations({ description: 'Content blocks returned by the tool.' })
  ),
  isError: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'McpToolResult',
    title: 'MCP Tool Result (wire format)',
    description: 'Wire-format result envelope for tools/call.',
  })
)

/** @public */
export type McpToolResult = typeof mcpToolResultSchema.Type

// ---------------------------------------------------------------------------
// MCP server info schema
// ---------------------------------------------------------------------------

/**
 * Schema for MCP server metadata returned during `initialize` handshake.
 */
export const mcpServerInfoSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  capabilities: Schema.Struct({
    tools: Schema.optional(Schema.Boolean),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'McpServerInfo',
    title: 'MCP Server Info (handshake)',
    description: 'Server metadata + capabilities returned during the initialize handshake.',
  })
)

/** @public */
export type McpServerInfo = typeof mcpServerInfoSchema.Type
