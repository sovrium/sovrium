/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Agent } from '@/domain/models/app/agents/agent'

export type McpAuthType = 'bearer' | 'header' | 'none'

export interface McpClientServer {
  readonly url: string
  readonly authType: McpAuthType
  readonly headerName?: string
  readonly token?: string
}

export interface McpClientTool {
  readonly name: string
  readonly description: string
}

export const DEFAULT_MCP_CLIENT_TOOL_CATALOG: ReadonlyArray<McpClientTool> = [
  { name: 'web-search', description: 'Search the public web for relevant pages and snippets.' },
  { name: 'document-fetch', description: 'Fetch a remote document or HTML page by URL.' },
]

const parseAuthType = (value: string | undefined): McpAuthType => {
  if (value === 'bearer') return 'bearer'
  if (value === 'header') return 'header'
  return 'none'
}

export const parseMcpClientServers = (
  env: Readonly<NodeJS.ProcessEnv>
): ReadonlyArray<McpClientServer> => {
  const raw = env.MCP_CLIENT_SERVERS
  if (raw === undefined || raw.trim() === '') return []

  const urls = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return urls.map((url, index) => {
    const slot = index + 1
    const authType = parseAuthType(env[`MCP_AUTH_TYPE_${slot}`])
    const token = env[`MCP_AUTH_TOKEN_${slot}`]
    const headerName = env[`MCP_AUTH_HEADER_${slot}`]
    return {
      url,
      authType,
      ...(headerName !== undefined && headerName !== '' && { headerName }),
      ...(token !== undefined && token !== '' && { token }),
    }
  })
}

export const computeAgentMcpToolCatalog = (
  servers: ReadonlyArray<McpClientServer>,
  agent: Agent | undefined
): ReadonlyArray<McpClientTool> => {
  if (servers.length === 0) return []
  const allowed = agent?.mcp?.allowedTools
  if (!allowed || allowed.length === 0) return DEFAULT_MCP_CLIENT_TOOL_CATALOG
  return allowed
    .map((name) => DEFAULT_MCP_CLIENT_TOOL_CATALOG.find((tool) => tool.name === name))
    .filter((tool): tool is McpClientTool => tool !== undefined)
}

export interface McpClientServerSummary {
  readonly url: string
  readonly authType: McpAuthType
  readonly headerName?: string
  readonly status: 'connecting'
}

export const summariseMcpClientServer = (server: McpClientServer): McpClientServerSummary => ({
  url: server.url,
  authType: server.authType,
  ...(server.headerName !== undefined && { headerName: server.headerName }),
  status: 'connecting',
})
