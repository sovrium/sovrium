/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  mcpClientStatusSchema,
  mcpClientToolsSchema,
  mcpDisabledSchema,
  mcpServerStatusSchema,
} from '@/domain/models/api/ai/mcp'
import { effectJsonResponse } from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

/**
 * Model Context Protocol (MCP) status routes — report the MCP server and
 * client enablement and the discovered tool catalog. When a mode is disabled
 * the route returns a `{ enabled: false, error }` envelope with status 404.
 */

const mcpDisabledResponse = (description: string) =>
  effectJsonResponse(mcpDisabledSchema, description)

/** MCP status route group. */
export const mcpGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/ai/mcp/server/status',
      summary: 'Get MCP server status',
      description: 'Reports whether the MCP server is enabled and its transport configuration.',
      operationIdBase: 'getMcpServerStatus',
      responses: {
        200: effectJsonResponse(mcpServerStatusSchema, 'MCP server enabled'),
        404: mcpDisabledResponse('MCP server is disabled'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/mcp/client/status',
      summary: 'Get MCP client status',
      description: 'Lists the configured external MCP servers (URLs and auth types, no tokens).',
      operationIdBase: 'getMcpClientStatus',
      responses: {
        200: effectJsonResponse(mcpClientStatusSchema, 'MCP client enabled'),
        404: mcpDisabledResponse('MCP client is disabled'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/ai/mcp/client/tools',
      summary: 'Get MCP client tools',
      description: 'Lists the discovered MCP tool catalog from the configured external servers.',
      operationIdBase: 'getMcpClientTools',
      responses: {
        200: effectJsonResponse(mcpClientToolsSchema, 'MCP tool catalog'),
        404: mcpDisabledResponse('MCP client is disabled'),
      },
    },
  ],
}
