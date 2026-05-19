/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


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

export type McpToolWireAnnotations = typeof McpToolWireAnnotationsSchema.Type


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

export type McpToolDefinition = typeof mcpToolDefinitionSchema.Type


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

export type McpToolResult = typeof mcpToolResultSchema.Type


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

export type McpServerInfo = typeof mcpServerInfoSchema.Type
