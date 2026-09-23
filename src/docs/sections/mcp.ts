/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
 * ─── ONE ARTICLE'S FRAGMENT LIVES UNDER `src/cli/` ─────────────────────────
 *
 * `mcp-config` documents the `sovrium mcp` verb, so by the placement rule its
 * fragment sits beside `src/cli/commands/mcp.ts` — the narrowest thing the
 * prose is true of is the command, not the HTTP route tree its four siblings
 * describe. The SECTION is still `mcp`, because a reader looking for the
 * config tools looks among the MCP articles and not in the CLI reference,
 * which carries the verb only as a one-line entry in its command table.
 *
 * A manifest may import a fragment from any directory; what `Doc File
 * Presence` asks is that the fragment sits in a DECLARED doc-bearing
 * directory, and `src/cli/commands` is one.
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
        'Pointing an assistant at the app — the configuration block every client shares, which header carries which credential, and the one request that proves filtering is live.',
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
        'Run `sovrium mcp` and let the AI client you already use read your configuration, its findings, its schema and its run state — over a pipe, with no server and no credentials — then switch on the tools that let it edit the file.',
      keywords: [
        'sovrium mcp',
        'stdio',
        'config tools',
        'config_read',
        'config_validate',
        'config_schema',
        'config_status',
        'config_write_file',
        'config_undo',
        'MCP_CONFIG_WRITE',
        'expectedSha',
        'mcpServers',
        '--project',
        'SOVRIUM_PROJECT_DIR',
      ],
      order: 6425,
      sidebarLabel: 'Config over MCP',
      body: mcpConfigBody,
      documents: [],
      stories: [
        'US-AI-MCP-SERVER-CONFIG-TOOLS',
        'US-CLI-COMMANDS-MCP',
        'US-CLI-COMMANDS-MCP-CONFIG-WRITE',
      ],
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
        'Your own agents calling tools hosted elsewhere — the positional environment variables that declare those servers, and the two allowlists that do not overlap.',
      keywords: [
        'sovrium',
        'MCP client',
        'MCP_CLIENT_SERVERS',
        'allowedTools',
        'external tools',
        'web-search',
      ],
      order: 6440,
      sidebarLabel: 'Client Mode',
      body: mcpClientModeBody,
      documents: [],
      stories: ['US-AI-MCP-CLIENT'],
    }),
  ],
})
