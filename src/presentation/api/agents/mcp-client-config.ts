/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The HTTP shape of MCP client mode: what the tools route lists. What an
 * agent's model is offered is the agent runtime's (`mcp-agent-tools.ts`).
 *
 * Everything here is built from what the declared servers actually returned
 * from `tools/list` (through the `McpClient` port). There is no seeded
 * catalogue: a server that is not connected contributes no tool.
 */

import type { McpToolDescriptor } from '@/domain/models/app/agents/mcp-tool-service'

/** One discovered tool, as `GET /api/ai/mcp/client/tools` lists it. */
export interface McpClientToolSummary {
  readonly server: string
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
}

export const summariseMcpTool = (tool: McpToolDescriptor): McpClientToolSummary => ({
  server: tool.server,
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
})
