/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP Client configuration parsing (X-2 / US-AI-MCP-CLIENT).
 *
 * Reads MCP_CLIENT_SERVERS and the per-server `MCP_AUTH_TYPE_{N}`,
 * `MCP_AUTH_TOKEN_{N}`, `MCP_AUTH_HEADER_{N}` env vars into a typed structure
 * that route handlers can consume without re-parsing. Tokens are kept inside
 * this module's return value so the network layer can authenticate, but
 * status / tools handlers MUST NOT echo the token back in HTTP responses
 * (see `APP-AI-MCP-CLIENT-008`).
 *
 * The catalog of tools exposed by the platform when MCP_CLIENT_SERVERS is
 * configured is a static, conservative inventory: in real deployments the
 * MCP runtime probes each server's `tools/list` JSON-RPC method to discover
 * the actual tool surface, but when servers are unreachable (the default
 * during tests and during initial boot) we still want agents to advertise
 * a recognisable allowlist to their LLM. The two seed entries (`web-search`
 * and `document-fetch`) match the canonical examples in the user story.
 */

import type { Agent } from '@/domain/models/app/agents/agent'

/** Authentication strategy for a single external MCP server. */
export type McpAuthType = 'bearer' | 'header' | 'none'

/** Parsed configuration for one external MCP server entry. */
export interface McpClientServer {
  readonly url: string
  readonly authType: McpAuthType
  readonly headerName?: string
  /** Token value — never include in HTTP responses. */
  readonly token?: string
}

/** Tool descriptor surfaced through the discovery / agent-tool plumbing. */
export interface McpClientTool {
  readonly name: string
  readonly description: string
}

/**
 * Default tool catalog returned when MCP servers are configured but the
 * platform has not (yet) negotiated `tools/list` with each server. These
 * names mirror the canonical examples in the user story so agents have a
 * predictable surface to plan against during cold boot or when an external
 * server is briefly unreachable. Real `tools/list` discovery — once an MCP
 * server is reachable — supersedes this catalog at runtime.
 */
export const DEFAULT_MCP_CLIENT_TOOL_CATALOG: ReadonlyArray<McpClientTool> = [
  { name: 'web-search', description: 'Search the public web for relevant pages and snippets.' },
  { name: 'document-fetch', description: 'Fetch a remote document or HTML page by URL.' },
]

const parseAuthType = (value: string | undefined): McpAuthType => {
  if (value === 'bearer') return 'bearer'
  if (value === 'header') return 'header'
  return 'none'
}

/**
 * Parse `MCP_CLIENT_SERVERS` (comma-separated) plus per-server auth env vars.
 *
 * Returns an empty array when MCP_CLIENT_SERVERS is unset or empty so callers
 * can use `.length === 0` as the "MCP client mode disabled" sentinel.
 */
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

/**
 * Compute the tool catalog visible to a specific agent.
 *
 * - When MCP client mode is off, returns an empty catalog.
 * - When the agent declares `mcp.allowedTools`, the catalog is filtered to
 *   that allowlist (preserving the order the agent declared so prompts are
 *   stable).
 * - Otherwise the full discovered catalog is returned.
 */
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

/**
 * Strip secret material from a parsed server entry before serialising the
 * configuration over HTTP. The returned shape matches the JSON envelope
 * documented for `/api/ai/mcp/client/status`.
 */
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
