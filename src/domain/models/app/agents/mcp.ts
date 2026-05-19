/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AgentMcpSchema = Schema.Struct({
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

export type AgentMcp = typeof AgentMcpSchema.Type
