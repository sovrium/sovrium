/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Agent MCP Configuration Schema
 *
 * Model Context Protocol client configuration for the agent.
 * Defines which MCP tools the agent is allowed to invoke.
 */
export const AgentMcpSchema = Schema.Struct({
  /** List of allowed MCP tool names the agent can invoke */
  allowedTools: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
      Schema.annotations({ description: 'MCP tool names the agent is allowed to use' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentMcp',
    title: 'Agent MCP Configuration',
    description: 'Model Context Protocol client configuration for the agent',
  })
)

/** @public */
export type AgentMcp = typeof AgentMcpSchema.Type
