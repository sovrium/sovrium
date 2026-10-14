/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/** A server name as the operator declares it in `MCP_CLIENT_SERVERS`: lowercase kebab-case. */
const MCP_SERVER_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * One external MCP server an agent may reach, by the name the operator gave it.
 *
 * The description sits before the checks: an annotation placed after a check
 * lands on the check rather than on the node the published schema documents.
 * The filter runs before `isPattern` so the message can name the value while
 * the published JSON Schema keeps its `pattern` (see `definition.ts`).
 */
const McpServerNameSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'The name of an external MCP server declared by the operator in MCP_CLIENT_SERVERS (lowercase kebab-case).',
    examples: ['registry', 'crm'],
  }),
  Schema.check(
    Schema.makeFilter((value) =>
      MCP_SERVER_NAME_PATTERN.test(value)
        ? true
        : `MCP server name ${JSON.stringify(value)} must be lowercase kebab-case (letters, digits and single hyphens — e.g. 'registry').`
    ),
    Schema.isPattern(MCP_SERVER_NAME_PATTERN)
  )
)

/**
 * Agent MCP Configuration Schema
 *
 * Which external MCP servers the agent may reach, and which of their tools.
 * The servers themselves (address, credential) are operator configuration in
 * the environment; the schema only NAMES them.
 */
export const AgentMcpSchema = Schema.Struct({
  /** The external MCP servers this agent may reach, by name. None when omitted. */
  servers: Schema.optional(
    Schema.Array(McpServerNameSchema).pipe(
      Schema.annotate({
        description:
          'The external MCP servers this agent may reach, by the names the operator declared in MCP_CLIENT_SERVERS. An agent that names none is offered no external tool. A name the environment does not declare stops the boot.',
        defaultNote: 'none: the agent reaches no external MCP server',
      }),
      Schema.check(Schema.isUnique({ message: 'mcp.servers must not name the same server twice' }))
    )
  ),
  /** List of allowed MCP tool names the agent can invoke */
  allowedTools: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
      Schema.annotate({
        description:
          "Narrows the tools of the servers in mcp.servers to these names: a tool's own name (lookup_company) or its qualified <server>__<tool> form. Every tool of those servers when omitted.",
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentMcp',
    title: 'Agent MCP Configuration',
    description:
      'Which external MCP servers the agent may reach, and which of their tools it is offered',
  })
)

/** @public */
export type AgentMcp = typeof AgentMcpSchema.Type
