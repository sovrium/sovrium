/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import mcpConfigWriteBody from '@/cli/commands/mcp-write.docs.md' with { type: 'file' }
import mcpConfigBody from '@/cli/commands/mcp.docs.md' with { type: 'file' }
import { AiAccessConfigSchema, ToolAnnotationsSchema } from '@/domain/models/app/auth/ai-access'
import mcpClientModeBody from '@/presentation/api/mcp/mcp-client-mode.docs.md' with { type: 'file' }
import mcpClientsBody from '@/presentation/api/mcp/mcp-clients.docs.md' with { type: 'file' }
import mcpIntegrationBody from '@/presentation/api/mcp/mcp-integration.docs.md' with { type: 'file' }
import mcpSecurityBody from '@/presentation/api/mcp/mcp-security.docs.md' with { type: 'file' }
import mcpServerBody from '@/presentation/api/mcp/mcp-server.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Model Context Protocol — the section manifest.
 *
 * Why one fragment lives under `src/cli/commands/`:
 * `[internal ref]`, § `mcp`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const mcp = defineSection({
  slug: 'mcp',
  title: 'Model Context Protocol',
  order: 6400,
  tab: 'agents',
  articles: [
    defineArticle({
      slug: 'mcp-integration',
      title: 'MCP Overview',
      description:
        'Sovrium speaks the Model Context Protocol in both directions — what separates server mode from client mode, and the environment that turns the server on.',
      keywords: [
        'sovrium',
        'MCP',
        'Model Context Protocol',
        'MCP_ENABLED',
        'MCP_TRANSPORT',
        'server mode',
        'client mode',
      ],
      order: 6400,
      sidebarLabel: 'MCP Overview',
      body: mcpIntegrationBody,
      documents: [],
      stories: ['US-AI-MCP-CROSS-001', 'US-AI-MCP-SERVER', 'US-AI-MCP-SERVER-TRANSPORT'],
    }),
    defineArticle({
      slug: 'mcp-server',
      title: 'Server Mode',
      description:
        'What becomes a tool once the server is running, how an entity declares itself eligible with aiAccess, and the risk hints a client reads before running a call.',
      keywords: [
        'sovrium',
        'aiAccess',
        'MCP tools',
        'fieldExposure',
        'whitelistFields',
        'tool annotations',
        'requireConfirmation',
      ],
      order: 6410,
      sidebarLabel: 'Server Mode',
      body: mcpServerBody,
      documents: [AiAccessConfigSchema, ToolAnnotationsSchema],
      stories: [
        'US-AI-MCP-SERVER-ACTIONS',
        'US-AI-MCP-SERVER-ADMIN-READS',
        'US-AI-MCP-SERVER-ANNOTATIONS',
        'US-AI-MCP-SERVER-AUTOMATIONS',
        'US-AI-MCP-SERVER-FIELD-PERMISSIONS',
        'US-AI-MCP-SERVER-TABLES',
      ],
    }),
    defineArticle({
      slug: 'mcp-clients',
      title: 'Connecting a Client',
      description:
        'Point an assistant at the app: the configuration block every client shares, which header carries which credential, and the request that proves filtering works.',
      keywords: [
        'sovrium',
        'mcpServers',
        'x-api-key',
        'dynamic client registration',
        'stdio',
        'tools/list',
      ],
      order: 6420,
      sidebarLabel: 'Connecting a Client',
      body: mcpClientsBody,
      documents: [],
      stories: ['US-AI-MCP-SERVER-DISCOVERY'],
    }),
    defineArticle({
      slug: 'mcp-config',
      title: 'Your Config over MCP',
      description:
        'Run `sovrium mcp` so your AI client reads your config, its findings, schema and run state over a pipe, with no server or credentials, and the skills as prompts.',
      keywords: [
        'sovrium mcp',
        'stdio',
        'config tools',
        'config_read',
        'config_validate',
        'config_schema',
        'config_status',
        'prompts',
        'agent skills',
        'mcpServers',
        '--project',
        'SOVRIUM_PROJECT_DIR',
      ],
      order: 6425,
      sidebarLabel: 'Config over MCP',
      body: mcpConfigBody,
      documents: [],
      stories: ['US-AI-MCP-SERVER-CONFIG-TOOLS', 'US-CLI-COMMANDS-MCP'],
    }),
    defineArticle({
      slug: 'mcp-config-write',
      title: 'Letting Your AI Edit the Config',
      description:
        'Switch on the four `sovrium mcp` tools that read, replace and undo your config files: what turns them on, every reason a write is refused, and how to go back.',
      keywords: [
        'MCP_CONFIG_WRITE',
        'config_list_files',
        'config_read_file',
        'config_write_file',
        'config_undo',
        'expectedSha',
        'acknowledgeDataLoss',
        'allowDestructive',
        'undo',
      ],
      order: 6427,
      sidebarLabel: 'Editing the Config over MCP',
      body: mcpConfigWriteBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-MCP-CONFIG-WRITE'],
    }),
    defineArticle({
      slug: 'mcp-security',
      title: 'Auth, RBAC and Rate Limiting',
      description:
        'An MCP connection is an authenticated actor calling your data — the two credentials, the five layers a call passes through, and what auditing and limits catch.',
      keywords: [
        'sovrium',
        'MCP auth',
        'API key',
        'OAuth',
        'RBAC',
        'rate limit',
        'audit',
        'MCP_EXPOSE_INTERNALS',
      ],
      order: 6430,
      sidebarLabel: 'Auth, RBAC & Limits',
      body: mcpSecurityBody,
      documents: [],
      stories: [
        'US-AI-MCP-SERVER-AUDIT',
        'US-AI-MCP-SERVER-AUTH-OAUTH',
        'US-AI-MCP-SERVER-AUTH-TOKENS',
        'US-AI-MCP-SERVER-INTERNALS',
        'US-AI-MCP-SERVER-RATE-LIMIT',
        'US-AI-MCP-SERVER-RBAC',
      ],
    }),
    defineArticle({
      slug: 'mcp-client-mode',
      title: 'Client Mode',
      description:
        'Your own agents reaching tools hosted on external MCP servers — how the operator names those servers, how an agent picks them, and what the status routes show.',
      keywords: [
        'sovrium',
        'MCP client',
        'MCP_CLIENT_SERVERS',
        'allowedTools',
        'mcp.servers',
        'external tools',
        'elicitation',
      ],
      order: 6440,
      sidebarLabel: 'Client Mode',
      body: mcpClientModeBody,
      documents: [],
      stories: ['US-AI-MCP-CLIENT', 'US-AI-MCP-CLIENT-ELICITATION'],
    }),
  ],
})
